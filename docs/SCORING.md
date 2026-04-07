# Scoring Model

## Category Weights

The overall score is the weighted average of six category scores.
Weights are fixed for MVP and apply identically to all sites.

| Category | Weight | Rationale |
|---|---|---|
| Technical SEO | 30% | Foundational — if crawling/indexing is broken, nothing else matters |
| On-Page SEO | 25% | Core ranking signal; titles, content, and headings are directly actionable |
| Structured Data | 15% | High leverage for rich results and entity understanding |
| Content / Cannibalization | 15% | Poor content architecture silently suppresses the whole site |
| AEO | 10% | Emerging signal; weighted meaningfully but not over-indexed |
| Local SEO | 5% | Relevant only for local businesses; low default weight prevents penalising SaaS sites |

Future: allow project-type selection (Local Business / eCommerce / Blog / SaaS)
that applies different weight presets.

---

## Severity Score Impact (per failing rule instance)

| Severity | Score deduction |
|---|---|
| CRITICAL | 20 points |
| HIGH | 10 points |
| MEDIUM | 5 points |
| LOW | 2 points |
| INFO | 0 points |

These are maximum deductions. The category score floor is 0 (never negative).

---

## Page-Level Score Calculation

```
For each page:
  For each IssueCategory (excluding SITE-scoped rules):
    rawCategoryScore = 100
    For each Issue on this page in this category:
      rawCategoryScore -= issue.scoreImpact
    pageCategoryScore[category] = max(0, rawCategoryScore)

  pageScore = sum(pageCategoryScore[c] × CATEGORY_WEIGHTS[c]) for all c
```

Only PAGE-scoped rules contribute to page scores.
SITE-scoped rules (CONTENT_*, TECH_013, TECH_014) contribute only to
the site-level category scores.

---

## Site-Level Score Calculation

```
For each IssueCategory:
  siteCategoryScore = average(pageCategoryScore[category] for all indexable pages)
  For each SITE-scoped Issue in this category:
    siteCategoryScore -= issue.scoreImpact
  siteCategoryScore = max(0, siteCategoryScore)

overallScore = sum(siteCategoryScore[c] × CATEGORY_WEIGHTS[c]) for all c
```

This means a single sitewide issue (e.g. 15 duplicate title pairs) applies its
deduction once to the site score, not multiplied per affected page. This prevents
one systemic issue from destroying the score beyond what's proportionate.

---

## Anti-Inflation Rules

### 1. One issue per (rule, page) pair
Even if a rule could fire multiple times on one page (e.g. 40 images missing alt
text), it fires once with evidence containing the count. The score impact is fixed
per rule, not multiplied by the number of violations.

**Rationale**: Multiplying per violation creates extreme score collapse and makes
fixing a single issue feel useless. One issue per rule per page keeps scores
readable and fixes meaningful.

### 2. Sitewide issues count once
A sitewide rule fires once per pair or once sitewide, contributing a single
`scoreImpact` to the site-level category score.

### 3. Category floor at 0
No category score goes below 0. Without this, heavy CRITICAL issues would make
the weighted average meaningless.

### 4. Indexable pages only
Pages with `isIndexable = false` (noindex or robots-blocked) are excluded from
the page score average. They still appear in the audit with their issues listed,
but they do not pull down the site score — a deliberate noindex should not
penalise sites that intentionally de-index admin or staging pages.

### 5. Skipped rules do not penalise
A rule that returns `skip` (because required data is absent or the rule does not
apply to this page type) contributes 0 to the score. It does not create a
phantom issue.

---

## Score Transparency

Every score shown in the UI links back to its contributing issues. The UI should:
1. Show the score formula (weighted category breakdown) in a tooltip.
2. Show per-category score + the issues that reduced it.
3. Show per-page scores ranked worst-first.

Score labels (opinionated, not industry-standard):
- 90–100: Excellent
- 75–89: Good
- 50–74: Needs Improvement
- 0–49: Poor

---

## Priority Score for Recommendations

```
priority = (severityWeight × 3) + (impactWeight × 2) + effortWeight

severityWeight: CRITICAL=5, HIGH=4, MEDIUM=3, LOW=2, INFO=1
impactWeight:   HIGH=3, MEDIUM=2, LOW=1
effortWeight:   LOW=3, MEDIUM=2, HIGH=1  (low effort = most desirable)

Tie-break: affectedPageCount DESC, then totalScoreImpact DESC
```

Lower priority number = fix first.
This favours: high severity, high impact, low effort — classic "quick wins first".
