<p align="center">
  <a href="https://github.com/actions/typescript-action/actions"><img alt="typescript-action status" src="https://github.com/actions/typescript-action/workflows/build-test/badge.svg"></a>
</p>

# Fuzzing-build-site-action
This GitHub Action script collects result files from multiple executions of a fuzzer, and builds a report that evaluates the performance of that fuzzer (KPIs include branches over time, total branches, total failures, inputs over time, total inputs). The action also will build comparisons between different branches of a repo, based on the input specified to it. Originally built to support [neu-se/CONFETTI](https://github.com/neu-se/CONFETTI), it also works with [rohanpadhy/JQF](https://github.com/rohanpadhye/JQF/), and should also easily support other forks of JQF.

## Usage
This action currently is dependent on a local shared storage volume that all of your GitHub Actions runners have access to. It would not be particularly difficult to adapt it to entirely use the GitHub Actions Artifact interface to push files around, and some generic "deploy static site" action, but it's not something that I've had time for yet. Frankly, I am unsure how you could run a significant fuzzing campaign without running your own runners anyway - it requires an enormous quantity of CI resources. If you are interested in using this action on your own self-hosted runners, it's probably easiest to fork it and update the paths hard coded in `main.ts`.

## Development
Build the typescript and package it for distribution
```bash
$ npm run build && npm run package
```

## Publish to a distribution branch

Actions are run from GitHub repos so we will checkin the packed dist folder. 

Then run [ncc](https://github.com/zeit/ncc) and push the results:
```bash
$ npm run package
$ git add dist
$ git commit -a -m "prod dependencies"
$ git push origin releases/v1
```

Note: We recommend using the `--license` option for ncc, which will create a license file for all of the production node modules used in your project.

Your action is now published! :rocket: 

See the [versioning documentation](https://github.com/actions/toolkit/blob/master/docs/action-versioning.md)

## Usage:

After testing you can [create a v1 tag](https://github.com/actions/toolkit/blob/master/docs/action-versioning.md) to reference the stable and latest V1 action
