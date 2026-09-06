---
layout: ../layouts/MarkdownLayout.astro
title: "Terms of use"
description: "The practical limits and acceptable-use terms for the CmdImpact web terminal, command checker and guides."
section: "Trust center"
---

_Effective: 6 September 2026_

By using CmdImpact, you agree to these terms. If you do not agree, do not use the software or service.

## Terminal responsibility

CmdImpact provides remote browser access to a shell on its host. Commands execute with the permissions available to the CmdImpact server process and may read, change, transmit or delete accessible data. Use CmdImpact only on systems you own or are authorized to administer.

You are responsible for securing the host and network connection, protecting the access token, choosing appropriate process permissions, reviewing commands, keeping recoverable backups and complying with the policies that apply to your device, employer and data.

Locking a phone, closing a tab or disconnecting a browser does not end an attached process. The runner machine and CmdImpact runner must remain online; a runner restart still ends live PTYs. Do not rely on CmdImpact as the only place where important work or output exists.

## Command guard

The command guard reviews every non-empty paste and the standalone checker reviews submitted text using static indicators and general educational information. They are not a security audit, sandbox, antivirus product or professional advice. Neither a finding nor the absence of a recognized risk means a command was fully understood, safe, correct or suitable for your environment.

"Paste as one line" replaces line breaks and other control characters with spaces. It does not remove shell operators such as `;`, `&&`, pipes, substitutions or redirects, and it does not make the paste safe or limit it to one action. Choosing "Send anyway" sends the original paste and may execute one or more commands immediately.

## No warranty

CmdImpact is an alpha provided "as is" and "as available." To the maximum extent allowed by law, no warranty is made that sessions, reconnections, output, checks or other features are complete, uninterrupted, current, error-free or suitable for a particular purpose.

## Limitation of liability

To the maximum extent allowed by law, CmdImpact and its contributors are not liable for indirect, incidental or consequential loss arising from use of the project, loss of a session, a missed or incorrect finding or execution of any command. Nothing in these terms excludes rights or liability that cannot legally be excluded.

## Acceptable use

Do not use CmdImpact to access a system without authorization, disrupt a service, bypass controls, distribute unlawful material or expose another person's data. Do not post credentials, personal data, private code or terminal output in public issue reports.

These terms may change as the project evolves. Material revisions will update the effective date. Questions can be raised through the [project issue tracker](https://github.com/khajaaijaz26/cmdimpact/issues).
