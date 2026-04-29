# OSRA — Hierarchical Report Upload & Mapping Console

**OSRA** (Operational Solvency Reporting Application) is a full-stack web application for managing Excel-based financial and regulatory reports. It lets users define mappings that specify **which sheet** and **which cell** in an Excel file contains each report item, then upload files and store the extracted values in a hierarchical structure. The system supports region/country/model organization and reporting-period applicability.

---

## What It Does (Brief)

OSRA:

1. **Defines mappings** — Upload an Excel file with columns: Code, Description, Sheet, Cell Reference. Each row says: “For code X, find the value in Sheet Y, cell Z.”
2. **Uploads data files** — Upload report Excel files. The app uses the active mapping to pull values from the right cells and store them in a tree structure.
3. **Shows hierarchy** — Browse reports as an expandable tree (e.g. SCR → Redeeming Fund → Capital Requirements), filter, search, and compare versions.
4. **Organizes by region** — Filter and categorize uploads by Region → Country → Model, year/month, and company.

---

## Complete Detailed Description

### 1. Core Concepts

| Concept | Description |
|--------|-------------|
| **Mapping** | An Excel template that defines Code → (Sheet, Cell Reference) for each report item. Example: Code `1.1.1` → Sheet `SM-1`, Cell `B2`. |
| **Report** | An uploaded Excel file with actual values. The app uses the active mapping to extract values from the right cells. |
| **Report node** | A single item in the hierarchy: code, description, value, sheet name, cell reference, level, parent. |
| **Version** | Multiple uploads can share the same report key; each gets a new version number for comparison. |

### 2. Main Features

#### Mapping Configuration
- **Upload mapping Excel** — Columns: Code, Description, Sheet, Cell Reference (flexible header variants supported).
- **Multiple mappings** — Store several mappings; one can be marked *active* for new uploads.
- **Versioning** — Each upload of a mapping creates a new version.
- **Activate / Delete** — Switch active mapping or remove old ones.

#### Upload
- **Cascading selectors** — Region → Country → Model, plus Year, Month, Company.
- **Report key** — Auto-generated (e.g. `APAC-Pakistan-OSRA-2026-01`) or custom.
- **Applicable regions** — Mark which regions a file applies to.
- **Active mapping** — When enabled, values are pulled from cells defined by the mapping. Otherwise, the file must include Code, Description, Value, Sheet, Cell Reference columns.

#### Dashboard
- **Filters** — Region, Country, Model, Company, Year, Month, Report key.
- **Latest only** — Option to show only the latest version per report key.
- **Tabbed workspace** — Open multiple reports in tabs.

#### Report tree view
- **Hierarchy** — Expandable tree (e.g. 1 → 1.1 → 1.1.1).
- **Values** — Each node shows description, value, sheet, and cell reference.
- **Search** — Filter tree by code or description.
- **Detail panel** — Click a node to see full details in a split view.

### 3. Data Model

#### Master data
- **Regions** — e.g. APAC, EMEA, Americas.
- **Countries** — Belong to a region (e.g. Pakistan, India, UK).
- **Application models** — Belong to a country (e.g. SCR, OSRA).
- **Companies** — Belong to a region.

#### Core tables
- **mapping** — One row per Code → Sheet, Cell. Rows sharing the same `config_id` form one mapping.
- **uploads** — Each upload: report_key, version_no, region_id, country_id, model_id, company_id, report_year, report_month.
- **report_nodes** — Extracted items per upload: code, level, parent_code, description, value, sheet_name, cell_ref.
- **report_region_applicability** — Which regions each upload applies to.

### 4. Architecture

| Layer | Technology |
|-------|------------|
| Frontend | React, Vite, TypeScript, Tailwind CSS |
| Backend | FastAPI (Python) |
| Database | Supabase (Postgres) or SQLite (local fallback) |
| Excel parsing | openpyxl |

### 5. Workflow

1. **Admin uploads mapping** — Excel with Code, Description, Sheet, Cell Reference.
2. **Admin activates mapping** — Used for subsequent uploads.
3. **User selects** — Region, Country, Model, Year, Month, Company (and optional applicable regions).
4. **User uploads report Excel** — Backend uses mapping to read values from the defined cells.
5. **User views tree** — Browse hierarchy, search, compare versions.

### 6. API Endpoints

| Endpoint | Purpose |
|----------|---------|
| `GET /regions` | List regions |
| `GET /regions/{id}/countries` | Countries in region |
| `GET /countries/{id}/models` | Models in country |
| `GET /companies` | List companies (optional region filter) |
| `GET /uploads` | List uploads (filters: region, country, model, company, year, month) |
| `POST /uploads` | Create upload with extracted nodes |
| `GET /uploads/{id}/tree` | Tree structure for an upload |
| `GET /uploads/{id}/nodes` | Flat list of nodes |
| `GET /mappings` | List mapping configurations |
| `POST /mappings` | Upload new mapping Excel |
| `GET /mappings/{id}/items` | Mapping items (Code → Sheet, Cell) |
| `POST /mappings/{id}/activate` | Set mapping as active |
| `DELETE /mappings/{id}` | Delete mapping |
| `GET /debug` | DB connection and mapping count |

### 7. Run Locally

**Backend:**
```powershell
cd backend
.\.venv\Scripts\python -m uvicorn app.main:app --reload --host 127.0.0.1 --port 8000
```

**Frontend:**
```powershell
cd frontend
npm run dev
```

Open http://localhost:5173 (or 5174 if 5173 is in use).

### 8. Database

- **Supabase** — Set `DATABASE_URL` in `backend/.env` (use pooler on port 6543 for transaction mode).
- **SQLite** — Use `DATABASE_URL=sqlite:///./osra.db` for local dev; data in `backend/osra.db`.
- **Migrations** — Run `000_full_schema.sql` and `001_region_country_model.sql` in Supabase SQL Editor.

### 9. Docker: run Postgres in Compose + migrate `orsa_db`

This repo can run the DB in Docker Compose (service name `db`). To migrate your existing database from `128.1.50.163` into the compose DB:

1) Ensure the **source** Postgres allows your dump connection in `pg_hba.conf` (otherwise `pg_dump` will fail).

2) From the repo root, run:

```powershell
./scripts/migrate_orsa_db.ps1 -SourceHost 128.1.50.163 -SourceUser postgres -SourceDb orsa_db -DumpFile orsa_db.dump
```

That script uses a temporary `postgres:16` container to run `pg_dump`, then restores into the `db` container via `pg_restore`.
        