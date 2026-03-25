# Program/Benefit Seed Data

This folder contains CSV exports for 5 realistic seed bundles tagged with `SEED20260325`.

Files:

- `program.csv`
- `benefit.csv`
- `programEnrollment.csv`
- `benefitAssignment.csv`
- `benefitDisbursement.csv`

Load order (if reloading in the same org with these IDs):

1. `program.csv`
2. `benefit.csv`
3. `programEnrollment.csv`
4. `benefitAssignment.csv`
5. `benefitDisbursement.csv`

Notes:

- These files include Salesforce record IDs and lookup IDs from org `260-pm`.
- For loading into a different org, replace ID-based lookups with external ID mappings.
