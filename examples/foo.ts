import http from "node:http";

import { execFile } from "./testutil.test.js";

// let foo = await testExecuteTokioCmd((ids, ...values) => {
//   console.log("callback");
//   console.log(values);
// });
// console.log("foo", foo);

http
  .createServer(async (_, res) => {
    let { stdout } = await execFile("echo", ["hello"]);
    res.end(stdout);
  })
  .listen(8001)
  .on("listening", async () => {
    let resp = await fetch("http://localhost:8001");
    console.log(await resp.text());
  });

export {};
