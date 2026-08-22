import { fetchText } from "../src/collector/http";

const url = "https://www.mytheresa.com/us/en/women/shoes";
const result = await fetchText(url, { delayMs: 0 });
console.log("status", result.status, "ok", result.ok, "len", result.text.length);
console.log("has next data", result.text.includes("__NEXT_DATA__"));
console.log("has product links", /\/p\//.test(result.text));
const sample = result.text.slice(0, 500);
console.log(sample);
