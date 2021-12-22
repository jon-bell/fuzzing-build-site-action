import * as core from '@actions/core'
import * as github from '@actions/github'
import { RestEndpointMethodTypes } from '@octokit/plugin-rest-endpoint-methods'
import * as fs from 'fs';
import * as io from '@actions/io'
import * as exec from '@actions/exec'
import { exit } from 'process';

type WorkflowRun = RestEndpointMethodTypes["actions"]["getWorkflowRun"]["response"]['data'];

type ComparisonsType = {
  thisRun: WorkflowRun
  byBranch: {
    name: string,
    workflow_runs: WorkflowRun[]
  }[]
}

let benchmarks: string[];
if (!core.getInput("benchmarks"))
  benchmarks = 'ant,bcel,closure,maven,rhino'.split(",");
else
  benchmarks = core.getInput("benchmarks").split(",");

async function getPathToAritfacts(wfRun: WorkflowRun) {
  //TODO reach into the artifact action instead of using local NFS
  return "/ci-logs/public/" + wfRun.repository.full_name + "/" +
    wfRun.head_sha + "/" + wfRun.name + "/" + wfRun.id + "/" + wfRun.run_attempt + "/artifacts"
}
function wfRunToMdDescription(refName: string, wfRun: WorkflowRun, isThis?: boolean) {
  return "* " + (isThis ? "Triggering" : "Last successful") + " run on: " + refName +
    "@[" + wfRun.head_sha.substring(0, 6) + "](" +
    wfRun.repository.html_url + "/commits/" + wfRun.head_sha + ')\n' +
    "   * Last commit " + wfRun.head_commit?.timestamp + " by " + wfRun.head_commit?.author?.name + '\n' +
    "   * [Workflow Results](" + wfRun.html_url + ')\n'
}
export async function buildSite(params: {
  head_sha?: string,
  head_ref?: string,
  head_html_url?: string,
  head_results_dir?: string,
  site_base_url: string,
  artifacts_base_url: string,
  comparisons: ComparisonsType,
  siteResultDir: string
}): Promise<{body: string, summary: string}> {
  const { comparisons, head_sha, head_ref } = params;
  let workflowName = "Evaluation Run";
  if (head_sha && comparisons.thisRun.name) {
    workflowName = comparisons.thisRun.name;
  } else {
    //Find workflow name from one of the comps
    findName:
    for (let branchRun of comparisons.byBranch) {
      for (let wfRun of branchRun.workflow_runs) {
        if (wfRun.name) {
          workflowName = wfRun.name;
          break findName;
        }
      }
    }
  }

  //Build report header
  let reportHeader;
  const dataDirs = [];
  if (comparisons.byBranch.length > 1 || (comparisons.byBranch.length == 1 && head_sha)) {
    reportHeader = 'Configurations evalauted:\n\n';
  }
  else {
    reportHeader = 'Configuration evaluated:\n\n';
  }
  if (head_ref) {
    reportHeader += wfRunToMdDescription(head_ref, comparisons.thisRun, true)
  }
  for (let branchRun of comparisons.byBranch) {
    for (let wfRun of branchRun.workflow_runs) {
      reportHeader += wfRunToMdDescription(branchRun.name, wfRun);
      dataDirs.push({ "name": branchRun.name, "path": await getPathToAritfacts(wfRun) });
    }
  }

  //Copy the site
  await io.cp("site-template", "site_build", { recursive: true });

  //Generate the report by repeatedly including the template
  let reportString = fs.readFileSync("site_build/index.Rmd", "utf-8");
  let templateString = fs.readFileSync("site_build/template.Rmd", "utf-8");
  const firstBlockEnd = templateString.indexOf("```", templateString.indexOf("```") + 3);
  templateString = templateString.substring(5 + firstBlockEnd).replace(/\%SITE_BASE_URL\%/g, params.site_base_url)

  reportString = reportString
    .replace(/\%GENERATED_TIME\%/g, new Date().toISOString())
    .replace(/\%EVALUATION_NAME\%/g, workflowName)
    .replace(/\%CONFIGS_LISTING\%/g, reportHeader)
    .replace(/\%SITE_BASE_URL\%/g, params.site_base_url)
    .replace(/\%ARTIFACTS_BASE_URL\%/g, params.artifacts_base_url)

  for (let bm of benchmarks) {
    bm = bm.trim();
    reportString += '---\n\n```{r ' + bm + '-configuration-gen, include=FALSE}\n'
    reportString += 'localParams=list(dataDirs=\'' + JSON.stringify({ "dataDirs": dataDirs }) + '\',  baseDir="/ci-logs/", artifactURL="https://ci.in.ripley.cloud/logs", benchmark="' + bm + '")\n\n'
    reportString += '```\n\n'
    reportString += '\n' + templateString.replace(/\%TARGET\%/g, bm).replace(/params\$/g, "localParams$") + '\n'
  }
  fs.writeFileSync("site_build/index.Rmd", reportString);

  await io.rmRF("site_build/template.Rmd")
  try {
    await exec.exec('R -e "renv::restore()"', [], { cwd: "site_build" });
    await exec.exec('R -e "rmarkdown::render_site()"', [], { cwd: "site_build" });
    await io.cp("site_build/_site", params.siteResultDir, { recursive: true, force: true });
    return {
      body: fs.readFileSync("site_build/_site/index.md", "utf-8") ,
      summary: "Summary tbd"
    }
  } catch (err) {
    console.error("Error generating site!")
    console.trace(err)
    return{
      body: "Error generating site",
      summary: "Error generating site, see logs for details"
    }
  }

}
export async function run(): Promise<void> {
  try {
    // const ms: string = core.getInput('milliseconds')
    // core.debug(`Waiting ${ms} milliseconds ...`) // debug is only output if you set the secret `ACTIONS_STEP_DEBUG` to true

    console.log(core.getInput("GITHUB_TOKEN"))

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
    // TODO refactor that action into this one?
    const comps = JSON.parse(core.getInput("comparisons")) as ComparisonsType 
    const thisRunKey = comps.thisRun.repository.full_name + "/" +
    comps.thisRun.head_sha + "/" + comps.thisRun.name + "/" + comps.thisRun.id + "/" + comps.thisRun.run_attempt;
    // const siteInfo = await buildSite({
    //   comparisons: comps, artifacts_base_url: "https://ci.in.ripley.cloud/logs/",
    //   siteResultDir: "/ci-logs/public/" + thisRunKey,
    //   site_base_url: "https://ci.in.ripley.cloud/logs/public/" +thisRunKey  + "/site"
    // }
    // )

    const req = {
      ...repo,
      name: "Deploy Evaluation Site",
      head_sha,
      status: "completed",
      conclusion: "success",
      output: {
        title: "Evaluation Report",
        // summary: siteInfo.summary,
        // text: siteInfo.body
        summary: "Some summary",
        text: thisRunKey
      },
      // actions: [{
      //   label: "Rebuild site",
      //   description: "Trigger this site to be rebuilt",
      //   identifier: "rebuild-site"
      // }]
    }
    const resp = await octokit.rest.checks.create(req);
    console.log(JSON.stringify(resp, null, 2));

    core.setOutput('time', new Date().toTimeString())
  } catch (error) {
    if (error instanceof Error) core.setFailed(error.message)
  }
}

run()
