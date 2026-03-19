# AFLS Mobile DB - Query Tool & Healthcheck Rules

## Overview

An Intelligent Content (IC) presentation for the LSC iPad app that provides three key capabilities for consultants:

1. **Object Browser** (default tab) - Browse available objects and their fields, select fields via checkboxes, generate SOQL queries
2. **Query Tool** - SOQL interface to query the local SQLite database on the iPad
3. **Healthcheck** - Automated rules that validate common configuration issues

## File Structure

```
01_Healthcheck/
  01_Healthcheck.html   - Main presentation (single-page app with tabs)
  js/
    bridge.js           - PresentationPlayer.fetchWithParams() bridge abstraction
    healthcheck.js      - Healthcheck rules engine
  fonts/                - Montserrat font files
```

No external dependencies (no jQuery, no swipe.js). Pure vanilla JavaScript.

## Bridge Layer (bridge.js)

The `LSCBridge` module wraps the official `PresentationPlayer.fetchWithParams()` API.

**Reference:** [Presentation Player Functions](https://help.salesforce.com/s/articleView?id=ind.lsc_presentation_player_functions.htm&type=5)

### Underlying API

```javascript
PresentationPlayer.fetchWithParams(query, params, callbackMethodName)
```

- `query` - SOQL string, or `queryLocator` for pagination
- `params` - `{ batchSize: N }` (max 100, default 15)
- `callbackMethodName` - **String** name of a global function (not a function reference)
- Returns JSON: `{ records, done, totalSize, queryLocator, state }`

### Bridge Methods

| Method | Description |
|--------|-------------|
| `LSCBridge.init(configData)` | Initialize bridge; pass `event.data` from `PresentationDOMContentLoaded`. Returns `true` if on device. |
| `LSCBridge.query(soql, callback)` | Run SOQL query with auto-pagination. `callback(err, records, meta)` |
| `LSCBridge.querySinglePage(soql, batchSize, callback)` | Single page fetch. `callback(err, data)` where data has `{ records, done, totalSize, queryLocator, state }` |
| `LSCBridge.fetchNext(queryLocator, callback)` | Continue pagination with queryLocator |
| `LSCBridge.getAvailableObjects()` | Returns static array of 45 common LSC object names |
| `LSCBridge.getObjectFields(objectName)` | Returns static array of default field names for an object (verified via describe) |
| `LSCBridge.isOnDevice()` | Returns boolean |
| `LSCBridge.getConfigData()` | Returns configData from PresentationDOMContentLoaded event |

### Initialization Pattern

```javascript
document.addEventListener('PresentationDOMContentLoaded', function (event) {
    LSCBridge.init(event.data);
    // event.data contains: { parameters: { id: userId, ... } }
});
```

When running on desktop (not on iPad), mock data is returned so the presentation can be tested in a browser.

### Callback Registration

Since `PresentationPlayer.fetchWithParams()` requires a **string** callback name, the bridge uses a global callback registry pattern. Each call creates a temporary `window._lscBridgeCb_N` function that auto-cleans up after execution.

### SOQL Support in fetchWithParams

The WHERE clause supports:
- Logical operators: `AND`, `OR`, `NOT`
- Comparison operators: `IN`, `LIKE`, `=`, `<`, `>`
- `IN` syntax: `Id IN {"val1","val2"}`
- `GROUP BY`, `HAVING`, `ORDER BY`, `LIMIT`, `OFFSET`
- No subqueries in SELECT

## Available Objects (45)

All objects are listed alphabetically in the Object Browser with pre-populated default fields:

| Object | Default Fields |
|--------|---------------|
| Account | Id, Name, AccountNumber, Type, Phone, BillingCity, BillingState, IsPersonAccount, PersonContactId, RecordTypeId |
| AccountContactRelation | Id, AccountId, ContactId, Roles, IsActive, IsDirect |
| AccountPlan | Id, Name, AccountId, Status, StartDate, EndDate, OwnerId, Notes, AccountVision, AccountStrategicPriorities |
| AccountTerritory2Association | Id, AccountId, Territory2Id |
| AppAlert | Id, Name, Subject, Message, Type, Severity, Source, EffectiveDate, ValidUntilDate, OwnerId |
| BusinessLicense | Id, Name, AccountId, LicenseNumber, Status, IsActive, LicenseClass, IssueDate, PeriodStart, PeriodEnd, HealthcareProviderId, ContactId |
| CommunicationSubscription | Id, Name, ContactPointId, DataUsePurposeId |
| CommunicationSubscriptionConsent | Id, CommunicationSubscriptionId, ConsentGiverId, EffectiveDateTime |
| Contact | Id, Name, FirstName, LastName, Email, Phone, AccountId, MailingCity, MailingState |
| ContactPointAddress | Id, Name, ParentId, AddressType, Street, City, State, PostalCode, Country, IsPrimary, IsActive |
| ContactPointConsent | Id, Name, ContactPointId, DataUsePurposeId, PrivacyConsentStatus, EffectiveFrom, EffectiveTo, CaptureSource |
| ContactPointEmail | Id, Name, ParentId, EmailAddress, IsPrimary, IsActive |
| ContactPointPhone | Id, Name, ParentId, TelephoneNumber, IsPrimary, IsActive, PhoneType |
| DataUsePurpose | Id, Name, Description, LegalBasis, IsActive, CanDataSubjectOptOut |
| Event | Id, Subject, WhoId, WhatId, StartDateTime, EndDateTime, Location, OwnerId |
| GoalDefinition | Id, Name, Description, Status, Type, Category, ScopeType, OwnerId, ParentGoalId, RecordTypeId |
| HealthcareProvider | Id, Name, AccountId, IsPrimaryProvider, IsActive, PractitionerId |
| HealthcareProviderNpi | Id, Name, HealthcareProviderId, Npi, NpiType, IsActive, EffectiveFrom, EffectiveTo, AccountId, PractitionerId |
| HealthcareProviderSpecialty | Id, Name, HealthcareProviderId, IsPrimary |
| HealthcarePractitionerFacility | Id, Name, PractitionerId, AccountId, IsPrimary, IsActive |
| IndividualVisit | Id, Name |
| KamAccountPlan | Id, Name, AccountId, Status, StartDate, EndDate, OwnerId |
| LifeSciMarketableProduct | Id, Name, ProductId, ProductCode, IsActive, Type, Description, StartDate, EndDate, ParentProductId, TherapeuticArea |
| ObjectTerritory2Association | Id, ObjectId, Territory2Id, AssociationCause |
| Presentation | Id, Name, IsActive |
| PresentationPage | Id, Name, PresentationId |
| Product2 | Id, Name, ProductCode, IsActive, Family, Description |
| ProductItem | Id, ProductItemNumber, Product2Id, QuantityOnHand, QuantityUnitOfMeasure, SerialNumber, LocationId |
| ProviderActivityGoal | Id, Name, AccountId, ActivityPlanId, OverallGoal, ProductLevelGoal, NonProductGoal, ActivityAttainmentPercentage, TotalActualActivityValue, TotalScheduledActivityValue |
| ProviderSampleLimit | Id, Name, AccountId, ProductId |
| RecordType | Id, Name, SobjectType, IsActive, DeveloperName |
| SampleTransaction | Id, Name, AccountId, Status, OwnerId, RecordTypeId |
| SampleTransactionItem | Id, Name, SampleTransactionId, Product2Id, Quantity |
| Survey | Id, Name, Description, ActiveVersionId |
| SurveyResponse | Id, Name, SurveyId, SurveyVersionId, Status, CompletedDateTime, SubmitterId |
| SurveySubject | Id, Name, SurveyResponseId, SubjectId, SubjectEntityType |
| Task | Id, Subject, WhoId, WhatId, Status, Priority, ActivityDate, OwnerId, Description |
| Territory2 | Id, Name, Territory2TypeId, ParentTerritory2Id, Description |
| Territory2Model | Id, Name, State, Description, ActivatedDate |
| TerritoryProdtQtyAllocation | Id, Name, TerritoryId, ProductId, AllocatedQuantity, RemainingQuantity, DebitedQuantity, AllocationType, TimePeriodId |
| User | Id, Name, Username, Email, IsActive, ProfileId, UserRoleId |
| UserTerritory2Association | Id, UserId, Territory2Id, RoleInTerritory2 |
| Visit | Id, Name, AccountId, Status, PlannedStartDateTime, ActualVisitStartTime |
| VisitedProduct | Id, Name, VisitId, ProductId |

**Note:** Field lists were verified via `describe_sobject`. Not all objects exist in every org — if a query fails, the object is not available in the local DB. Use the Object Browser checkboxes to discover additional fields.

## Query Templates

Pre-built query buttons are available for common objects:

| Template | Query |
|----------|-------|
| HCP Query | `SELECT Id, Name, IsPrimaryProvider, IsActive, AccountId FROM HealthcareProvider LIMIT 50` |
| Account Query | `SELECT Id, Name, Type, Phone, BillingCity FROM Account LIMIT 50` |
| Visit Query | `SELECT Id, Name, AccountId, Status, PlannedStartDateTime FROM Visit LIMIT 50` |
| Affiliation Query | `SELECT Id, Name, PractitionerId, AccountId, IsPrimary, IsActive FROM HealthcarePractitionerFacility LIMIT 50` |
| Territory Query | `SELECT Id, ObjectId, Territory2Id FROM ObjectTerritory2Association LIMIT 50` |
| Address Query | `SELECT Id, ParentId, AddressType, City, State, IsPrimary FROM ContactPointAddress LIMIT 50` |
| Sample Limits | `SELECT Id, Name, AccountId, ProductId FROM ProviderSampleLimit LIMIT 50` |

## Healthcheck Rules

### Current Rules

| # | Rule ID | Name | Category | Severity | What It Checks |
|---|---------|------|----------|----------|----------------|
| 1 | `HCP_PRIMARY_PROVIDER` | HealthcareProvider - IsPrimaryProvider Flag | Account Management | HIGH | All HealthcareProvider records should have `IsPrimaryProvider = true`. Records without this flag may not appear correctly in the provider card or territory assignments. |
| 2 | `HCP_ACTIVE` | HealthcareProvider - IsActive Flag | Account Management | MEDIUM | HealthcareProvider records should be active. Inactive providers typically shouldn't be synced to the device. |
| 3 | `AFFILIATION_PRIMARY` | HealthcarePractitionerFacility - Primary Affiliation Exists | Account Management | HIGH | Every practitioner should have at least one `IsPrimary = true` on `HealthcarePractitionerFacility`. Missing primary affiliations can affect provider card display. |
| 4 | `ADDRESS_PRIMARY` | ContactPointAddress - Primary Address Exists | Account Management | MEDIUM | Every account should have at least one `IsPrimary = true` address. Missing primary addresses cause issues with visit planning and provider card. |
| 5 | `TERRITORY_ASSIGNMENT` | Account - Territory Assignment | Territory Alignment | HIGH | Accounts should be assigned to at least one territory via `ObjectTerritory2Association`. Unassigned accounts won't appear in account lists. |
| 6 | `VISIT_STATUS` | Visit - Open Visits Check | Visit Management | LOW | Checks for visits stuck in incomplete status (not Completed or Submitted). Uses `Visit` object. |
| 7 | `SAMPLE_LIMITS` | ProviderSampleLimit - Records Exist | Sample Management | MEDIUM | Checks that sample limit records exist in the local DB. |
| 8 | `CONSENT_STATUS` | CommunicationSubscriptionConsent - Consent Captured | Consent Management | MEDIUM | Verifies consent records exist in the local DB. |

### Rule Severity Levels

- **HIGH** - Critical configuration issue that will cause visible problems
- **MEDIUM** - Configuration concern that may affect functionality
- **LOW** - Informational check, may not indicate a problem

### Rule Result Statuses

- **PASS** - Check passed, no issues found
- **FAIL** - Check failed, action required
- **WARN** - Warning, review recommended
- **SKIP** - Could not run (object not available or query error)

## Adding New Rules

To add a new healthcheck rule, edit `js/healthcheck.js` and add to the `rules` array:

```javascript
{
    id: 'UNIQUE_RULE_ID',
    name: 'Display Name',
    category: 'Category Name',
    description: 'What this rule checks and why it matters.',
    severity: 'high',  // high, medium, low
    check: function (callback) {
        LSCBridge.query(
            'SELECT Field1, Field2 FROM ObjectName LIMIT 100',
            function (err, records) {
                if (err) { callback('skip', 'Error: ' + err, []); return; }
                if (!records || records.length === 0) {
                    callback('skip', 'No records found.', []);
                    return;
                }
                var failing = records.filter(function (r) {
                    return /* your condition */;
                });
                if (failing.length === 0) {
                    callback('pass', 'All records OK.', []);
                } else {
                    callback('fail', failing.length + ' record(s) have issues.', failing);
                }
            }
        );
    }
}
```

Then update this document with the new rule details.

## Deployment

1. Zip the `01_Healthcheck` folder: `cd IC_Healthcheck && zip -r 01_Healthcheck.zip 01_Healthcheck/`
2. Upload the ZIP as an IC presentation in Salesforce (Presentation record)
3. Distribute to territory or assign globally
4. Open from the IC content player on the iPad

### Prerequisites

- User must have Read permissions on queried objects and fields
- Active object metadata cache configurations (DB Schema) must exist for each object
- Objects must be synced to the LSC mobile app

## Known Limitations

- `fetchWithParams` returns max 100 records per call (bridge auto-paginates)
- The `getAvailableObjects()` and `getObjectFields()` lists are static and may not match every org's schema
- Mock data is returned when running outside the iPad (desktop browser testing)
- No subqueries in SELECT statements (fetchWithParams limitation)
- Some objects (KamAccountPlan, SampleTransaction, SampleTransactionItem) require specific features/licenses to be enabled

## API Name Corrections

The following corrections were made based on `describe_sobject` verification:

| Wrong Name | Correct API Name |
|------------|-----------------|
| ProviderVisit | Visit |
| ProviderAffiliation | HealthcarePractitionerFacility |
| IsPrimaryAffiliation | IsPrimary |
| MarketableProduct | LifeSciMarketableProduct |
| TerritoryProductQtyAllocation | TerritoryProdtQtyAllocation |

## Changelog

- **2026-03-18** - v5: Renamed to AFLS Mobile DB. Folder renamed to 01_Healthcheck. Object Browser is now the default tab. Created README.md. Cleaned up stale files.
- **2026-03-18** - v4: Added comprehensive default fields for all 45 objects (verified via describe_sobject). Fixed API names: MarketableProduct -> LifeSciMarketableProduct, TerritoryProductQtyAllocation -> TerritoryProdtQtyAllocation. Brightened text colors for readability.
- **2026-03-18** - v3: Fixed object/field API names across all objects. Removed wrong names (ProviderVisit->Visit, ProviderAffiliation->HealthcarePractitionerFacility, IsPrimaryAffiliation->IsPrimary, SpecialtyCode->removed, etc). Added checkbox field selection to Object Browser. Conservative field lists - use browser to discover additional fields.
- **2026-03-18** - v2: Rewrote to use `PresentationPlayer.fetchWithParams()`. Removed jQuery and swipe.js. Renamed to 01_Healthcheck.html. Pure vanilla JS. Uses `PresentationDOMContentLoaded` event.
- **2026-03-18** - v1: Initial version with CLMPlayer bridge
