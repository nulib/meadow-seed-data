const { convertArrayToCSV } = require("convert-array-to-csv");
const fetch = require("node-fetch");
const fs = require("fs");
const progress = require("cli-progress");
const promiseRetry = require("promise-retry");
const { exit } = require("process");

const baseUrl = process.env.DCAPI_BASE || "https://dcapi.stack.rdc.library.northwestern.edu/search";
const iiifBase = process.env.IIIF_BASE || "https://iiif.stack.rdc.library.northwestern.edu/iiif/2";

class DCExport {
  constructor(collectionId, size) {
    this.collectionId = collectionId;
    this.size = size;
  }

  async makeCsv() {
    if (!fs.existsSync(this.collectionId)) {
      fs.mkdirSync(this.collectionId);
    }
    let data = await this.fetchCollectionData();
    let downloadInfo = data.map((entry) => entry.download);
    let rows = data.map((entry) => entry.row);

    let csv = convertArrayToCSV(rows, {
      header: [
        "work_accession_number",
        "accession_number",
        "filename",
        "description",
        "role",
      ],
    });
    fs.writeFileSync(`${this.collectionId}.csv`, csv);

    await this.downloadFileSets(downloadInfo);

    return `${this.collectionId}.csv`;
  }

  async fetchCollectionData() {
    let imageResponse = await this.fetchImages();
    let images = imageResponse.hits.hits;
    let progressBar = new progress.SingleBar(
      {
        format: "Image Info  {bar} {percentage}% | {value}/{total} records",
        stopOnComplete: true,
      },
      progress.Presets.shades_classic
    );
    progressBar.start(images.length, 0);

    let result = Promise.all(
      images.map(async (imageData) => {
        let result = await this.fetchImageInfo(imageData);
        progressBar.increment();
        return result;
      })
    )
      .catch((err) => {
        console.error("ERROR RETRIEVING INFO: ", err);
        return process.exit();
      })
      .then((result) => result.flat());
    return result;
  }

  async fetchImages() {
    let query = {
      query: {
        bool: {
          must: [
            {
              match: {
                "collection.id": this.collectionId,
              },
            },
            {
              match: {
                "model.name": "Image",
              },
            },
          ],
        },
      },
      _source: ["accession_number", "member_ids"],
      size: this.size,
    };

    let response = await fetch(`${baseUrl}/common/_search`, {
      method: "post",
      body: JSON.stringify(query),
      headers: { "Content-Type": "application/json" },
    });

    return response.json();
  }

  async downloadFileSets(downloadInfo) {
    let progressBar = new progress.SingleBar(
      {
        format: "Image Files {bar} {percentage}% | {value}/{total} downloaded",
        stopOnComplete: true,
      },
      progress.Presets.shades_classic
    );
    progressBar.start(downloadInfo.length, 0);

    await Promise.all(
      downloadInfo.map(async ({ id, filename }) => {
        let response = await fetch(
          `${iiifBase}/${id}/full/!2048,2048/0/default.jpg`
        );
        fs.writeFileSync(filename, await response.buffer(), () => {});
        progressBar.increment();
      })
    );
  }

  async fetchImageInfo(image) {
    let workAccessionNumber = image._source.accession_number;

    return Promise.all(
      image._source.member_ids.map(async (fileSetId, index) => {
        let response = await promiseRetry(() => fetch(`${baseUrl}/common/_doc/${fileSetId}`));
        let fileSet = await response.json();
        let info = fileSet._source;
        let imageFilename = `${this.collectionId}/${info.label.replace(
          ".tif",
          ".jpg"
        )}`;

        return {
          download: { id: fileSetId, filename: imageFilename },
          row: [
            workAccessionNumber,
            `${workAccessionNumber}_FILE_${index}`,
            imageFilename,
            info.label,
            "am",
          ],
        };
      })
    );
  }
}

module.exports = async (collectionId, size) => {
  let exporter = new DCExport(collectionId, size);
  return await exporter.makeCsv();
};
