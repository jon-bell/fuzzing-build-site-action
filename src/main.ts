import * as core from '@actions/core'
import * as github from '@actions/github'
import { wait } from './wait'

async function run(): Promise<void> {
  try {
    const ms: string = core.getInput('milliseconds')
    // core.debug(`Waiting ${ms} milliseconds ...`) // debug is only output if you set the secret `ACTIONS_STEP_DEBUG` to true

    const octokit = github.getOctokit(core.getInput("GITHUB_TOKEN"));
    const repo = {
      ...github.context.repo,
    }
    if (core.getInput("repo")) {
      const manualRepo = core.getInput("repo").split("/");
      repo.owner = manualRepo[0];
      repo.repo = manualRepo[1];
    }
    let head_sha = github.context.sha;
    if (core.getInput("head_sha")) {
      head_sha = core.getInput("head_sha");
    }
    const req = {
      ...repo,
      name: "Testing checks API",
      head_sha,
    }
    const resp = await octokit.rest.checks.create(req);
    console.log(JSON.stringify(resp, null, 2));

    core.setOutput('time', new Date().toTimeString())
  } catch (error) {
    if (error instanceof Error) core.setFailed(error.message)
  }
}

run()
