#! /usr/bin/env node

const exporter = require("./dcExport");

exporter(process.argv[2], process.argv[3]).then((data) => console.log(data));
