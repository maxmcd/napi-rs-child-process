#![deny(clippy::all)]
use napi::bindgen_prelude::{Buffer, Object};
use napi::threadsafe_function::{ThreadsafeFunction, ThreadsafeFunctionCallMode};
use napi::{Env, JsObject, Result};
use std::collections::HashMap;
use std::os::unix::process::ExitStatusExt;
use std::process::Stdio;
use tokio::io::AsyncReadExt;
use tokio::process::Command;

#[macro_use]
extern crate napi_derive;

#[napi(object)]
pub struct NapiSpawnOptions {
  pub cwd: Option<String>,
  pub env: Option<Object>,
  pub argv0: Option<String>,
}

impl NapiSpawnOptions {
  fn get_env(&self) -> HashMap<String, String> {
    if let Some(cmd_env) = &self.env {
      if let Ok(keys) = Object::keys(&cmd_env) {
        return keys
          .into_iter()
          .filter_map(|key| {
            cmd_env
              .get::<&String, String>(&key)
              .ok()
              .flatten()
              .map(|val| (key, val))
          })
          .collect();
      }
    }
    return HashMap::new();
  }
}

#[napi(ts_return_type = "Promise<number>")]
pub fn op_spawn(
  env: Env,
  cmd: String,
  args: Vec<String>,
  spawn_options: NapiSpawnOptions,
  exit_cb: ThreadsafeFunction<(i32, i32)>,
  stdout_cb: ThreadsafeFunction<Option<Buffer>>,
  stderr_cb: ThreadsafeFunction<Option<Buffer>>,
) -> Result<JsObject> {
  let envs = spawn_options.get_env();
  env.spawn_future(async move {
    let mut new_command = Command::new(cmd);
    let mut command = new_command
      .args(args)
      .envs(envs)
      .stdout(Stdio::piped())
      .stderr(Stdio::piped());
    if let Some(cwd) = spawn_options.cwd {
      command = command.current_dir(cwd);
    }
    if let Some(argv0) = spawn_options.argv0 {
      command = command.arg0(argv0);
    }

    let mut child = command.spawn()?;

    let mut stdout = child.stdout.take().unwrap();
    tokio::spawn(async move {
      let mut buf: [u8; 8192] = [0; 8192]; //chunk size (8K, 65536, etc)
      while let Ok(size) = stdout.read(&mut buf[..]).await {
        if size == 0 {
          break;
        }
        stdout_cb.call(
          Ok(Some(buf[0..size].to_owned().into())),
          ThreadsafeFunctionCallMode::NonBlocking,
        );
      }
      // Done reading bytes, call with None to signal end of stream.
      stdout_cb.call(Ok(None), ThreadsafeFunctionCallMode::NonBlocking);
    });
    let mut stderr = child.stderr.take().unwrap();
    tokio::spawn(async move {
      let mut buf: [u8; 8192] = [0; 8192]; //chunk size (8K, 65536, etc)
      while let Ok(size) = stderr.read(&mut buf[..]).await {
        if size == 0 {
          break;
        }
        stderr_cb.call(
          Ok(Some(buf[0..size].to_owned().into())),
          ThreadsafeFunctionCallMode::NonBlocking,
        );
      }
      // Done reading bytes, call with None to signal end of stream.
      stderr_cb.call(Ok(None), ThreadsafeFunctionCallMode::NonBlocking);
    });
    let child_id = child.id().unwrap();
    tokio::spawn(async move {
      let status = child.wait().await.unwrap();
      exit_cb.call(
        Ok((
          status.code().or(Some(0)).unwrap(),
          status.signal().or(Some(0)).unwrap(),
        )),
        ThreadsafeFunctionCallMode::NonBlocking,
      );
    });

    Ok(child_id)
  })
}
