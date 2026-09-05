---
layout: ../../layouts/MarkdownLayout.astro
title: "What PowerShell iwr pipe iex does"
description: "Understand the iwr-to-iex installer pattern and why downloading and execution should be reviewed as separate actions."
section: "Guide"
ads: true
---

A compact PowerShell installer can look like this:

```powershell
iwr https://example.com/setup.ps1 | iex
```

`iwr` is an alias for `Invoke-WebRequest`. Microsoft documents it as a command that sends a request to a web page or service. `iex` is an alias for `Invoke-Expression`, which evaluates a string as a command in the current scope. Together, the pipeline can turn a web response directly into commands on your computer.

Read the official references for [Invoke-WebRequest](https://learn.microsoft.com/en-us/powershell/module/microsoft.powershell.utility/invoke-webrequest) and [Invoke-Expression](https://learn.microsoft.com/en-us/powershell/module/microsoft.powershell.utility/invoke-expression).

## Why Invoke-Expression changes the risk

PowerShell is not merely displaying the downloaded text. `Invoke-Expression` can run it. Microsoft advises using it only as a last resort and warns about passing untrusted strings to it in its [security guidance](https://learn.microsoft.com/en-us/powershell/scripting/learn/deep-dives/avoid-using-invoke-expression).

That does not mean every installer using the pattern is malicious. It means the short command hides an important trust decision.

## Inspect before execution

Download to an ordinary file first:

```powershell
Invoke-WebRequest https://example.com/setup.ps1 -OutFile setup.ps1
```

Open `setup.ps1` as text. Check the expected publisher and review file writes, downloads, scheduled tasks, profile edits, environment variables and elevated operations. Do not execute it merely because a second AI says it looks safe.

CmdImpact flags the compact pipeline as direct remote execution. It never downloads the script, so it cannot verify the file behind the URL. Use the [checker](/#checker) as a first pause, not a final security approval.
