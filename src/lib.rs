#![deny(clippy::all)]
use futures::prelude::*;
use napi::bindgen_prelude::{Buffer, Error, Object, Status};
use napi::threadsafe_function::{
  ThreadSafeCallContext, ThreadsafeFunction, ThreadsafeFunctionCallMode,
};
use napi::{CallContext, Env, JsFunction, JsObject, Result};
use std::collections::HashMap;
use std::os::unix::process::ExitStatusExt;
use std::process::Stdio;
use tokio::io::AsyncReadExt;
use tokio::process::Command;

#[macro_use]
extern crate napi_derive;

#[module_exports]
fn init(mut exports: JsObject, _env: Env) -> Result<()> {
  register_js(&mut exports)?;
  Ok(())
}

pub fn register_js(exports: &mut JsObject) -> Result<()> {
  exports.create_named_method("spawn", test_execute_tokio_cmd)?;
  Ok(())
}

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

#[js_function(6)]
pub fn test_execute_tokio_cmd(ctx: CallContext) -> Result<JsObject> {
  let cmd = ctx.get::<String>(0)?;
  let args = ctx.get::<Vec<String>>(1)?;
  let spawn_options = ctx.get::<NapiSpawnOptions>(2)?;
  let envs = spawn_options.get_env();

  let exit_func = ctx.get::<JsFunction>(3)?;
  let exit_tsfn =
    ctx
      .env
      .create_threadsafe_function(&exit_func, 0, |ctx: ThreadSafeCallContext<Vec<i32>>| {
        Ok(ctx.value)
      })?;
  let stdout_func = ctx.get::<JsFunction>(4)?;
  let stdout_tsfn: ThreadsafeFunction<Vec<Buffer>> = ctx.env.create_threadsafe_function(
    &stdout_func,
    0,
    |ctx: ThreadSafeCallContext<Vec<Buffer>>| Ok(ctx.value),
  )?;
  let stderr_func = ctx.get::<JsFunction>(5)?;
  let stderr_tsfn = ctx.env.create_threadsafe_function(
    &stderr_func,
    0,
    |ctx: ThreadSafeCallContext<Vec<Buffer>>| Ok(ctx.value),
  )?;
  ctx.env.execute_tokio_future(
    cb_tokio_cmd(
      cmd,
      args,
      spawn_options.cwd,
      spawn_options.argv0,
      envs,
      exit_tsfn,
      stdout_tsfn,
      stderr_tsfn,
    )
    .map(|v| {
      v.map_err(|e| {
        Error::new(
          Status::GenericFailure,
          format!("failed to read file, {}", e),
        )
      })
    }),
    |&mut env, data| env.create_uint32(data),
  )
}

async fn cb_tokio_cmd(
  cmd: String,
  args: Vec<String>,
  cwd: Option<String>,
  argv0: Option<String>,
  envs: HashMap<String, String>,
  exit_cb: ThreadsafeFunction<Vec<i32>>,
  stdout_cb: ThreadsafeFunction<Vec<Buffer>>,
  stderr_cb: ThreadsafeFunction<Vec<Buffer>>,
) -> Result<u32> {
  // println!("envs: {:?}", envs);
  let mut new_command = Command::new(cmd);
  let mut command = new_command
    .args(args)
    .env_clear()
    .envs(envs)
    .stdout(Stdio::piped())
    .stderr(Stdio::piped());
  if let Some(cwd) = cwd {
    command = command.current_dir(cwd);
  }
  if let Some(argv0) = argv0 {
    command = command.arg0(argv0);
  }

  let mut child = command.spawn().unwrap();

  let mut stdout = child.stdout.take().unwrap();
  tokio::spawn(async move {
    let mut buf: [u8; 8192] = [0; 8192]; //chunk size (8K, 65536, etc)
    while let Ok(size) = stdout.read(&mut buf[..]).await {
      if size == 0 {
        break;
      }
      stdout_cb.call(
        Ok(vec![buf[0..size].to_vec().into()]),
        ThreadsafeFunctionCallMode::NonBlocking,
      );
    }
    stdout_cb.call(Ok(vec![]), ThreadsafeFunctionCallMode::NonBlocking);
  });
  let mut stderr = child.stderr.take().unwrap();
  tokio::spawn(async move {
    let mut buf: [u8; 8192] = [0; 8192]; //chunk size (8K, 65536, etc)
    while let Ok(size) = stderr.read(&mut buf[..]).await {
      if size == 0 {
        break;
      }
      stderr_cb.call(
        Ok(vec![buf[0..size].to_vec().into()]),
        ThreadsafeFunctionCallMode::NonBlocking,
      );
    }
    stderr_cb.call(Ok(vec![]), ThreadsafeFunctionCallMode::NonBlocking);
  });
  let child_id = child.id().unwrap();
  tokio::spawn(async move {
    let status = child.wait().await.unwrap();

    exit_cb.call(
      Ok(vec![
        status.code().or(Some(0)).unwrap(),
        status.signal().or(Some(0)).unwrap(),
      ]),
      ThreadsafeFunctionCallMode::NonBlocking,
    );
  });
  Ok(child_id)
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
