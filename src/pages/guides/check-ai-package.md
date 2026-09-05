---
layout: ../../layouts/MarkdownLayout.astro
title: "How to check a package suggested by AI"
description: "Verify the exact package name, version, publisher and source before running an npm or pip installation command from an AI answer."
section: "Guide"
ads: true
---

AI coding assistants can suggest package names that look realistic but are wrong. A USENIX Security study tested 16 code-generating models and documented package hallucinations across both commercial and open models. Read the [research paper and materials](https://www.usenix.org/conference/usenixsecurity25/presentation/spracklen).

An installation command is an action, not just documentation:

```sh
npm install package-name
python -m pip install package-name
```

The [npm documentation](https://docs.npmjs.com/cli/install/) explains that `npm install` installs the named package and its dependencies. The [Python Packaging User Guide](https://packaging.python.org/en/latest/tutorials/installing-packages/) describes the equivalent pip workflow.

## Check the exact name

Open the public registry yourself and search for the exact spelling. Do not silently choose the closest result. For scoped npm packages, include the full `@owner/name` value.

If a package is missing, the AI may be wrong—or it may refer to a private registry. Ask for the official project link instead of trying similarly named public packages.

## Existence is not proof of trust

A package appearing in a registry proves only that the registry has a record under that name. Review:

- the publisher or owning organization;
- the linked source repository and documentation;
- the version and publication date;
- deprecation or yanked-release notices;
- whether the package is established enough for your use; and
- the install scope and scripts it may run.

Pinning a version improves reproducibility, but does not prove that the selected version is trustworthy.

## Keep the installation contained

Prefer a project directory or Python virtual environment over global or system-wide installation. Read the lockfile changes before committing them. If the answer asks for administrator access, understand why the package needs it.

CmdImpact identifies common installation commands and tells you to review the package. Live registry verification is intentionally not presented as a “safe package” badge. Paste the install line into the [checker](/#checker) for the first review step.
