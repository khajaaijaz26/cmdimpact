---
layout: ../layouts/MarkdownLayout.astro
title: "About CmdImpact"
description: "Why CmdImpact adds a clear review step between an AI-generated terminal command and your computer."
section: "About"
---

CmdImpact answers one practical question: **what might this pasted command do?**

People now receive terminal commands from ChatGPT, Claude, Codex, Copilot, Gemini, GitHub projects and ordinary web pages. The command may be correct, but a user should not need deep shell knowledge to notice that it downloads code, deletes a directory, asks for administrator access or contains a credential.

## The product idea

CmdImpact is a pause button at the copy-paste moment. Paste the command before placing it in Terminal. The page identifies supported text patterns, shows the matching line and explains what deserves review.

It is deliberately not another chatbot. It does not ask an AI to judge an AI. The first version uses published, deterministic checks that return the same result for the same text.

## Private by design

The checker runs in the browser. It does not execute the command, contact its URLs, inspect your files or save the text. Advertising is kept off the checker page.

## Honest results

A clean pattern scan is not proof that a command is safe. Custom functions, aliases, variables, downloaded content and program-specific behavior can change the result. CmdImpact says what it found and what it could not prove.

The source is available on [GitHub](https://github.com/khajaaijaz26/cmdimpact). Errors and missing patterns can be reported without posting confidential information.
