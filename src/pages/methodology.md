---
layout: ../layouts/MarkdownLayout.astro
title: "How CompatNavi decides fit"
description: "The source, review and verdict rules behind every compatibility result."
---

_Last updated: 5 September 2026_

CompatNavi exists to answer a narrow question clearly: **does this product match the setup and expectations a person has described?** We do not award a universal “best.” A product can fit one home and fail another.

## Launch scope

The first catalog covers consumer smart video doorbells. We evaluate compatibility facts that commonly change a purchase decision:

- available power and installation method;
- network connection and published Wi-Fi bands;
- named smart-home platforms;
- local or cloud recording paths;
- whether a paid plan is needed for recorded history;
- useful behavior during an internet outage.

Image quality, design and advanced detection are shown as context, but they do not override a hard installation mismatch.

## Source hierarchy

We prefer sources in this order:

1. the manufacturer's technical specification or support page for the exact model;
2. the manufacturer's current product page or manual;
3. an official platform owner's documentation for platform-specific requirements.

Retail listings, reviews, search snippets and forum posts are not treated as proof of a compatibility fact. They may reveal a question worth investigating, but the published catalog must link to the underlying official source.

Each product page names the source publisher, direct URL, region and date checked. We do not copy manufacturer product images unless licensing is clear.

## Unknown is a real result

An empty manufacturer specification is not evidence of either support or non-support. When a relevant fact cannot be confirmed from the cited sources, CompatNavi records **Unknown**.

This is intentionally less satisfying than a guess. It is also safer. Unknown tells you what to ask the manufacturer before buying.

## Verdict rules

The personal fit checker compares only the requirements you select.

- **Fits:** every selected requirement matches a verified fact.
- **Fits with limits:** the product can be used, but a platform mismatch, recording plan or internet dependency may change the experience.
- **Doesn't fit:** at least one hard requirement—such as available power, network type or required storage—is unsupported.
- **Unknown:** an important selected requirement is not answered by the cited manufacturer material, and no harder limitation already determines the result.

Hard blockers take priority over softer limitations, and limitations take priority over unknowns. The numerical score is used only to order results; it is not a quality rating.

The rules are published in the project's [`src/lib/fit.ts`](https://github.com/khajaaijaz26/compatnavi/blob/master/src/lib/fit.ts) file and covered by a runnable test.

## Subscription language

“Not required” means the cited product offers its listed core recording path without a recurring product subscription. It does not promise that every feature, third-party platform or cloud backup is free.

“For recordings” means basic live functionality may work without a plan, but reviewing stored video history needs a paid plan according to the cited source.

“Optional” means a useful recording path exists without that product's paid plan, while a paid service can add storage or features.

## Regions and changing products

Product names, electrical requirements, platform features, plans and availability can differ by country and change after review. The catalog names the region used for each entry. Always open the cited source and confirm the exact model before ordering or installing.

The review date is a freshness signal, not a guarantee that nothing changed afterward. Items with stale or contradictory sources should be rechecked before being promoted in recommendations.

## Editorial independence

Fit verdicts are calculated from product facts and user selections. Advertisers cannot purchase a verdict, ranking, source omission or favorable edit. Paid placements, if enabled, are labeled and kept away from controls that could be mistaken for ad interactions.

CompatNavi does not currently use affiliate links. If that changes, links and the policy will be disclosed clearly without changing compatibility rules.

## Corrections

Found a wrong model, changed requirement or better official source? [Open a correction issue](https://github.com/khajaaijaz26/compatnavi/issues) with the product name, region, disputed fact and direct manufacturer URL. A correction should update the fact, review date and any affected verdict behavior together.

## Limits

CompatNavi is decision support, not electrical, security, legal or safety advice. It cannot inspect your transformer, Wi-Fi signal, local law, building permission or exact device firmware. Follow manufacturer instructions and use a qualified installer where appropriate.
