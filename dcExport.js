const { convertArrayToCSV } = require("convert-array-to-csv");
const fetch = require("node-fetch");
const baseUrl = process.env.ELASTICSEARCH_BASE;

class DCExport {
  constructor(collectionId, size) {
    this.collectionId = collectionId;
    this.size = size;
  }

  async makeCsv() {
    let data = await this.fetchCollectionData();
    return convertArrayToCSV(data, {
      header: [
        "work_accession_number",
        "accession_number",
        "filename",
        "description",
        "role",
      ],
    });
  }

  async fetchCollectionData() {
    let imageResponse = await this.fetchImages();
    let images = imageResponse.hits.hits;
    return Promise.all(
      images.map(async (imageData) => await this.fetchImageInfo(imageData))
    ).then((result) => result.flat());
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

    let response = await fetch(`${baseUrl}_search`, {
      method: "post",
      body: JSON.stringify(query),
      headers: {
        "Content-Type": "application/json",
      },
    });

    return response.json();
  }

  async fetchImageInfo(image) {
    let workAccessionNumber = image._source.accession_number;

    return Promise.all(
      image._source.member_ids.map(async (fileSetId, index) => {
        let response = await fetch(`${baseUrl}common/_doc/${fileSetId}`);
        let fileSet = await response.json();
        let info = fileSet._source;
        return [
          workAccessionNumber,
          `${workAccessionNumber}_FILE_${index}`,
          `${this.collectionId}/${info.label}`,
          info.label,
          "AM",
        ];
      })
    );
  }
}

module.exports = async (collectionId, size) => {
  let exporter = new DCExport(collectionId, size);
  return await exporter.makeCsv();
};
