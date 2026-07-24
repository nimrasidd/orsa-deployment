# Proposal: OSRA — Operational Solvency Reporting Application

**Solvency Dashboard (ORSA Workspace)**  
**Prepared by:** SHMA / SIR Consultants  
**Purpose:** Adopt a governed digital platform for solvency eForms (Excel-based regulatory reports), capital analysis, and management insight  

---

## 1. Executive Summary

Insurance and takaful organisations prepare solvency and ORSA (Own Risk and Solvency Assessment) submissions using structured Excel workbooks — commonly called **solvency eForms**. Today these files are often handled manually: cells are copied into spreadsheets, versions are emailed, and management receives numbers without a clear audit trail.

**OSRA (Operational Solvency Reporting Application)** turns those eForms into a secure, multi-company web workspace. It maps each regulatory code to the correct sheet and cell once, then repeatedly extracts values from new submissions. Teams can then analyse trends, compare versions, and brief leadership with charts and AI-assisted narratives — without re-keying data.

**Recommendation:** Deploy OSRA as the standard intake and analytics layer for solvency eForms across companies, models (e.g. SCR, OSRA, Solvency II), and reporting periods.

---

## 2. The Problem We Solve

| Challenge today | Business impact |
|-----------------|-----------------|
| Manual extraction from Excel eForms | Slow reporting cycles; high risk of copy/paste error |
| Unclear which template/version was used | Weak auditability for supervisors and internal review |
| Spreadsheets siloed by entity or analyst | Hard to compare companies, periods, or model versions |
| Capital metrics not ready for executives | Delayed ORSA / board packs; limited early warning |
| Growing template changes over time | Remapping by hand is costly and inconsistent |

Solvency eForms already contain the right data (SCR, MCR, capital requirements, risk categories). What is missing is a **controlled system** to extract, store, compare, and explain that data.

---

## 3. What Are Solvency eForms in This Context?

In OSRA, **solvency eForms** are the regulatory-style Excel workbooks (`.xlsx` / `.xls` / `.xlsm`) used for capital and ORSA reporting. Typical content includes:

- Solvency Capital Requirement (**SCR**) and related hierarchy  
- Minimum Capital Requirement (**MCR**) and surplus / deficit views  
- Risk modules (e.g. underwriting, credit, investment, operational)  
- Period labels (year / quarter / month) suited to supervisory and internal reporting  

OSRA does not replace the regulator’s template. It **uses** those templates as the system of record for values, by reading defined cells through a reusable **mapping**.

---

## 4. How OSRA Uses Solvency eForms

### 4.1 Map once

An administrator uploads a **mapping workbook** that defines:

| Column | Meaning |
|--------|---------|
| Code | Hierarchical item (e.g. `1.1.1`) |
| Description | Label (e.g. capital requirement line) |
| Sheet | Worksheet name in the eForm |
| Cell Reference | Exact cell to read (e.g. `B12`) |

The hierarchy (parent/child levels) is derived from the code structure. Mappings are versioned; one mapping can be marked **active** for each application model.

### 4.2 Upload repeatedly

Users upload the filled **report eForm** for a company, model, and reporting period. OSRA:

1. Applies the active mapping  
2. Extracts values from the mapped cells  
3. Stores them as versioned **report nodes** in a tree (e.g. SCR → sub-modules → line items)  
4. Keeps prior versions for comparison and audit  

Optional preview lets users confirm extracted values before saving.

### 4.3 Analyse and compare

| Capability | Benefit |
|------------|---------|
| Hierarchical tree & node detail | Drill from SCR totals to underlying cells |
| Dashboard charts & period tables | Track capital metrics over time |
| Side-by-side upload compare | Spot changes between two submissions of the same model |
| Filters (company, model, period, latest-only) | Focus on what matters for ORSA or group review |

### 4.4 Brief management (Insights)

The Home / Insights view builds:

- Headline KPIs with period-over-period change  
- Top movers and rule-based alerts (e.g. material drops)  
- A short narrative (OpenAI-assisted or rule-based fallback) framed for ORSA / capital adequacy discussion  

This turns raw eForm cells into **decision-ready language** for management and ORSA packs.

---

## 5. Solution Overview

**Product:** Solvency Dashboard (OSRA) — ORSA workspace  
**Brand context:** SHMA  

**Core modules**

1. **Secure access** — Login; public “Request access”; admin user & company management  
2. **Mappings & models** — Models by country (e.g. SCR, OSRA, Solvency II); versioned mappings  
3. **Upload** — Company-scoped eForm intake with mapping-based extraction  
4. **Reports library** — Browse, open, and manage uploaded versions  
5. **Dashboard** — Trends and hierarchical chart-tables  
6. **Compare** — Two uploads, same model, value deltas by code  
7. **Insights** — KPIs, alerts, and AI / template narrative  
8. **Settings** — Companies (region/country) and users (admin)  

**Governance**

- Company users see only their entity’s data  
- Admins manage mappings, models, companies, and users across the group  
- Uploads are versioned with report key, period, model, and company  

**Technology (deployment-ready)**

- Web application (React + FastAPI + PostgreSQL)  
- Docker Compose production stack for private / on-prem hosting  
- Optional OpenAI for narratives; works without AI using rule-based text  

---

## 6. Benefits for Our Organisation

### 6.1 Speed and efficiency
- Eliminate repetitive cell-by-cell copying from solvency eForms  
- Shorter cycle from “file received” to “figures available in dashboards”  
- One mapping serves many successive reporting periods  

### 6.2 Accuracy and auditability
- Values always come from defined sheet/cell references  
- Full history of uploads and mapping versions  
- Clear lineage from UI figure → code → original eForm cell  

### 6.3 Multi-entity and multi-jurisdiction scale
- Structure: Region → Country → Model → Company  
- Support SCR / OSRA / Solvency II-style models per market  
- Group and local teams work in one governed platform  

### 6.4 Better ORSA and board readiness
- Trend analysis and hierarchical capital views ready for discussion  
- Compare submissions before filing or after template changes  
- Insights narratives and alerts support early risk conversation (SCR ratio, concentration, KRIs)  

### 6.5 Control and security
- Role separation (admin vs company user)  
- Company data isolation for entity users  
- Centralised onboarding via access request and admin provisioning  

### 6.6 Resilience to template change
- New mapping versions when eForm layouts change  
- Activate the correct mapping without rebuilding the whole process  
- Download / compare mappings to manage change cleanly  

### 6.7 Cost and operational fit
- Reuses Excel eForms already used by actuarial / finance / compliance  
- No need to replace the regulator’s template  
- Docker-based deploy fits controlled internal environments  

---

## 7. Illustrative End-to-End Workflow

```text
1. Admin creates / selects model (e.g. SCR for a country)
2. Admin uploads mapping Excel for that model → activate
3. User uploads completed solvency eForm for Company X, Period Y
4. System extracts mapped cells → stores versioned hierarchy
5. Team reviews tree, dashboard trends, and optional compare
6. Management opens Insights for KPIs, alerts, and narrative
```

**Result:** Solvency eForms remain the source documents; OSRA becomes the **operating system** for using them repeatedly with confidence.

---

## 8. Who Benefits

| Stakeholder | Value |
|-------------|--------|
| Actuarial / Capital teams | Faster, consistent extraction and validation |
| Risk / ORSA owners | Structured history, movers, and alerts for assessment |
| Finance / Reporting | Version control and multi-period views |
| Management / Board | Clear capital story without waiting on ad-hoc packs |
| IT / Ops | Containerised deploy, JWT auth, Postgres data store |
| Group / Multi-company | Shared platform with company-level isolation |

---

## 9. Implementation Outline

| Phase | Activities | Outcome |
|-------|------------|---------|
| **1. Foundation** | Deploy production stack; configure companies, users, CORS/security | Live secure environment |
| **2. Mapping** | Load official eForm mapping(s) for priority model(s) | Active extraction rules |
| **3. Pilot** | Upload recent periods for 1–2 companies; validate vs Excel | Confidence in figures |
| **4. Rollout** | Expand companies/models; train users; set Insights preferences | BAU reporting process |
| **5. Enhance** | Optional OpenAI key; refine risk filters and ORSA pack exports | Stronger executive use |

Typical success criteria for pilot: mapping covers required SCR/MCR lines; extracted totals match Excel; dashboard and insights usable for one ORSA / capital review cycle.

---

## 10. Why Adopt Now

- Solvency and ORSA expectations continue to demand **timely, explainable capital evidence**  
- Excel eForms will remain the practical filing format for the foreseeable future  
- Building another spreadsheet process increases operational risk; OSRA **industrialises** the eForm workflow we already depend on  
- Early adoption creates a clean historical store of capital metrics for future stress tests, peer review, and group consolidation  

---

## 11. Closing Recommendation

We propose adopting **OSRA — Solvency Dashboard** as the organisation’s platform for **solvency eForms usage**:

1. **Map** regulatory Excel templates once  
2. **Upload** completed eForms on a recurring cycle  
3. **Analyse, compare, and brief** using governed data and insights  

This reduces manual effort, strengthens auditability, and improves the quality and speed of ORSA and capital conversations — while keeping the familiar Excel eForm as the submission format.

---

## Appendix A — Feature Snapshot

- Mapping upload (Code, Description, Sheet, Cell) with activation & versioning  
- Report eForm upload with preview and hierarchical storage  
- Dashboard filters, charts, and chart-tables by period  
- Upload detail tree / nodes; multi-upload compare  
- AI or rule-based Insights (SCR/MCR-oriented narrative)  
- Admin Settings: companies (region/country) and users  
- JWT authentication; company-scoped access for non-admins  

## Appendix B — Suggested One-Line Pitch

> **OSRA turns solvency eForms into a governed ORSA workspace — map cells once, upload repeatedly, then analyse, compare, and brief management with confidence.**
