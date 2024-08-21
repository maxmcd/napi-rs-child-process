import http from "node:http";

import { spawn } from "napi-rs-child-process";

// let foo = await testExecuteTokioCmd((ids, ...values) => {
//   console.log("callback");
//   console.log(values);
// });
// console.log("foo", foo);

http
  .createServer(async (_, res) => {
    spawn("/usr/bin/echo", ["hello"], {
      env: { PATH: process.env.PATH },
    }).stdout.on("data", (data) => {
      res.end(data);
    });
  })
  .listen(8001)
  .on("listening", async () => {
    let resp = await fetch("http://localhost:8001");
    console.log(await resp.text());
  });

export {};
