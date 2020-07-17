# Meadow Seed Data

## Usage

`./bin/dcdownload NAME QUERY [COUNT]`

* `NAME`: The name of the CSV file and subdirectory to save data to
* `QUERY`: A valid ElasticSearch query or a DC collection ID
* `COUNT`: The maximum number of works to export

## Examples

The following two queries are equivalent:
```
$ ./bin/dcdownload export_1 d4671cda-6ed8-48b9-8031-88b5940d572e 10
$ ./bin/dcdownload export_2 '{"collection.id": "d4671cda-6ed8-48b9-8031-88b5940d572e" }' 10
```