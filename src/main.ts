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
      status: "completed",
      conclusion: "success",
      output: {
        title: "We ran a bunch of checks",
        summary: "#This is some markdown\n\nAnd it has mutliple lines!",
        text: "##This is the summary text..."
      },
      images: [{
        image_url: "https://ci.in.ripley.cloud/logs/public/jon-bell/JQF-dev/596758abe2ab1cdadf890451ccf1025c1d9aca41/Smoke%20test%20evaluation%20-%2010%20minutes%2c%205%20trials/1608537067/1/site/index_files/figure-html/unnamed-chunk-3-1.png",
        alt: "Ant branch probes over time",
        caption: "Ant: Branch probes over time."
      },{
        image_url: "https://ci.in.ripley.cloud/logs/public/jon-bell/JQF-dev/596758abe2ab1cdadf890451ccf1025c1d9aca41/Smoke%20test%20evaluation%20-%2010%20minutes%2c%205%20trials/1608537067/1/site/index_files/figure-html/unnamed-chunk-6-1.png",
        alt: "Ant inputs executed over time",
        caption: "Ant: Inputs executed over time."
      }],
      actions: [{
        label: "Rebuild site",
        descripton: "Trigger this site to be rebuilt from the same source data, but using the most recent site action",
        identifier: "rebuild-site"
      }]
    }
    const resp = await octokit.rest.checks.create(req);
    console.log(JSON.stringify(resp, null, 2));

    core.setOutput('time', new Date().toTimeString())
  } catch (error) {
    if (error instanceof Error) core.setFailed(error.message)
  }
}

run()
