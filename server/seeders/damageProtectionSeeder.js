"use strict";

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    const now = new Date();

    await queryInterface.bulkInsert("TermsAndConditions", [
      {
        type: "damage_protection",
        version: 1,
        title: "Kleanr Homeowner Damage Protection Policy",
        contentType: "text",
        content: `
# KLEANR HOMEOWNER DAMAGE PROTECTION POLICY
## Property Damage Claims and Liability Terms

| | |
|---|---|
| **Document Version** | 1.0 |
| **Last Updated** | February 18, 2026 |
| **Effective Date** | February 18, 2026 |

---

Welcome to the Kleanr Homeowner Damage Protection Policy ("Damage Protection Policy" or "Policy"). This Policy governs all matters related to property damage that may occur during cleaning services facilitated through the Kleanr platform.

> **IMPORTANT:** This Damage Protection Policy applies to ALL Homeowners ("Clients") who book cleaning services through the Kleanr platform. By using Kleanr's services, you agree to be bound by this Policy.

> **NOTICE:** This Policy contains important provisions regarding damage reporting requirements, liability limitations, claims procedures, and binding arbitration. Please read carefully.

---

# SECTION 1
## Overview and Scope

**1.1 Purpose of This Policy**

This Damage Protection Policy establishes:

| Coverage Area | Description |
|---------------|-------------|
| **Damage Reporting** | Procedures for reporting property damage |
| **Claims Process** | How damage claims are evaluated and processed |
| **Liability Allocation** | Responsibility distribution among parties |
| **Coverage Limitations** | What is and is not covered |
| **Dispute Resolution** | How damage disputes are resolved |
| **Compensation Guidelines** | How damages are valued and compensated |

**1.2 Parties Covered**

This Policy applies to:

- **Homeowners/Clients**: Property owners who book cleaning services
- **Cleaners**: Independent contractors providing cleaning services
- **Business Owners**: Cleaning business owners who employ cleaners
- **Business Employees**: Employees of cleaning business owners
- **Kleanr**: The platform facilitating these services

**1.3 Integration with Other Agreements**

This Policy supplements and is incorporated into:

- The Kleanr Terms of Service
- The Kleanr Privacy Policy
- The Kleanr Payment Terms of Service
- The Kleanr Independent Contractor Agreement (for Cleaners)

In the event of conflict, the more specific provision shall control.

---

# SECTION 2
## Definitions

**2.1 Key Terms**

For purposes of this Damage Protection Policy:

| Term | Definition |
|------|------------|
| **"Actual Cash Value" (ACV)** | Current market value of damaged property, accounting for depreciation |
| **"Claim"** | A formal request for compensation for alleged damage |
| **"Claimant"** | The party filing a damage claim |
| **"Cleaning Service"** | Residential or commercial cleaning booked through Kleanr |
| **"Covered Damage"** | Damage eligible for consideration under this Policy |
| **"Damage Assessment"** | Evaluation of damage extent and value |
| **"Damage Report"** | Initial documentation of alleged damage |
| **"Excluded Damage"** | Damage not covered under this Policy |
| **"Incident"** | Any event resulting in property damage during service |
| **"Pre-Existing Condition"** | Damage or wear present before the cleaning service |
| **"Property"** | Real and personal property at the service location |
| **"Replacement Cost"** | Cost to replace damaged item with equivalent new item |
| **"Service Location"** | The address where cleaning services are performed |
| **"Service Period"** | Time from Cleaner arrival to departure |

---

# SECTION 3
## Types of Damage Covered

**3.1 Covered Damage Categories**

Subject to the limitations in this Policy, the following types of damage may be considered for claims:

| Category | Examples |
|----------|----------|
| **Breakage** | Broken dishes, vases, figurines, glassware |
| **Surface Damage** | Scratches on floors, countertops, furniture |
| **Fabric Damage** | Stains, tears, or discoloration to upholstery, curtains, linens |
| **Appliance Damage** | Damage to appliances during cleaning |
| **Fixture Damage** | Damage to light fixtures, faucets, hardware |
| **Electronic Damage** | Damage to electronics from cleaning products or water |
| **Wall/Ceiling Damage** | Marks, holes, or damage from cleaning activities |

**3.2 Conditions for Coverage**

For damage to be considered covered, ALL of the following must be true:

> **COVERAGE REQUIREMENTS:**
>
> 1. Damage occurred during the Service Period
> 2. Damage was caused directly by the Cleaner's actions
> 3. Damage was not pre-existing
> 4. Damage was reported within required timeframes
> 5. Damage is not excluded under Section 4
> 6. Proper documentation is provided

**3.3 Burden of Proof**

The Claimant bears the burden of proving:

- The item was in undamaged condition before service
- The damage occurred during the Service Period
- The Cleaner's actions caused the damage
- The claimed value is accurate and reasonable

---

# SECTION 4
## Excluded Damage (Not Covered)

**4.1 Absolute Exclusions**

The following are NEVER covered under this Policy:

| Exclusion | Reason |
|-----------|--------|
| **Pre-existing damage** | Damage present before service |
| **Normal wear and tear** | Expected deterioration over time |
| **Manufacturing defects** | Inherent product flaws |
| **Acts of God** | Natural disasters, weather events |
| **Pest damage** | Damage caused by insects, rodents, etc. |
| **Structural damage** | Foundation, walls, roof (beyond surface) |
| **Plumbing/electrical systems** | Unless directly damaged by cleaning |
| **HVAC systems** | Heating, ventilation, air conditioning |
| **Landscaping** | Outdoor plants, gardens, lawns |
| **Vehicles** | Cars, motorcycles, boats |
| **Currency and securities** | Cash, checks, bonds, stocks |
| **Jewelry and precious metals** | Unless specifically photographed pre-service |
| **Artwork over $5,000** | High-value art requires separate coverage |
| **Antiques over $5,000** | High-value antiques require separate coverage |
| **Collectibles** | Sports memorabilia, coins, stamps, etc. |

**4.2 Conditional Exclusions**

The following are excluded UNLESS specific conditions are met:

| Item | Condition for Coverage |
|------|------------------------|
| **Electronics** | Must be reported within 24 hours |
| **Fragile items** | Must have been reasonably placed/stored |
| **Items requiring special care** | Must have been noted in booking |
| **Pet-related damage** | Must prove Cleaner caused, not pet |
| **Water damage** | Must prove Cleaner was source |

**4.3 Behavioral Exclusions**

No coverage applies when:

> **COVERAGE VOIDED IF:**
>
> - Homeowner provided false information about property condition
> - Homeowner failed to secure valuable or fragile items
> - Homeowner failed to disclose hazardous conditions
> - Homeowner interfered with Cleaner's work
> - Homeowner's instructions caused the damage
> - Claim is fraudulent or exaggerated

**4.4 High-Value Item Limitations**

| Item Value | Coverage Limitation |
|------------|---------------------|
| **Under $100** | Full consideration |
| **$100 - $500** | Requires photo documentation |
| **$500 - $2,500** | Requires receipt/proof of value |
| **$2,500 - $5,000** | Requires appraisal documentation |
| **Over $5,000** | NOT COVERED without prior arrangement |

---

# SECTION 5
## Damage Reporting Requirements

**5.1 Immediate Reporting**

For any damage you believe occurred during service:

| Action | Timeframe |
|--------|-----------|
| **In-app damage report** | Within 24 hours of service completion |
| **Photo documentation** | At time of discovery |
| **Written description** | Within 24 hours |
| **Cleaner notification** | Before Cleaner leaves (if possible) |

**5.2 Required Documentation**

All damage reports MUST include:

> **MANDATORY DOCUMENTATION:**
>
> 1. Clear photographs of the damage (multiple angles)
> 2. Photographs showing context/location
> 3. Written description of what was damaged
> 4. When the damage was discovered
> 5. Estimated value of the item
> 6. Proof of pre-service condition (if available)

**5.3 Reporting Deadlines**

| Report Type | Deadline | Consequence of Missing |
|-------------|----------|------------------------|
| **Initial notice** | 24 hours | Claim may be denied |
| **Full documentation** | 72 hours | Claim may be denied |
| **Additional evidence** | 7 days | Evidence not considered |
| **Final claim submission** | 14 days | Claim forfeited |

**5.4 Late Reporting**

> **WARNING:** Failure to report damage within 24 hours creates a presumption that the damage did not occur during service. This presumption may only be overcome with clear and convincing evidence.

**5.5 Reporting Methods**

Damage must be reported through:

- **Primary**: Kleanr mobile app damage reporting feature
- **Secondary**: Email to damage-claims@kleanr.com
- **NOT ACCEPTED**: Phone calls, text messages, social media

---

# SECTION 6
## Claims Investigation Process

**6.1 Investigation Initiation**

Upon receiving a damage report, Kleanr will:

| Step | Timeframe |
|------|-----------|
| **Acknowledge receipt** | Within 24 hours |
| **Assign investigator** | Within 48 hours |
| **Contact all parties** | Within 72 hours |
| **Begin investigation** | Within 5 business days |

**6.2 Investigation Activities**

The investigation may include:

- Review of submitted photographs and documentation
- Interview with Homeowner
- Interview with Cleaner
- Review of service notes and check-in/check-out records
- Request for additional documentation
- Consultation with third-party experts (if needed)
- On-site inspection (in cases over $1,000)

**6.3 Cleaner Response**

Cleaners will be notified of claims and may:

- Provide their account of events
- Submit photographs taken during service
- Identify pre-existing conditions they observed
- Contest the claim with evidence

**6.4 Investigation Timeline**

| Claim Value | Target Resolution |
|-------------|-------------------|
| **Under $250** | 7 business days |
| **$250 - $1,000** | 14 business days |
| **$1,000 - $5,000** | 21 business days |
| **Over $5,000** | 30 business days |

**6.5 Investigation Outcomes**

Possible outcomes include:

| Outcome | Description |
|---------|-------------|
| **Claim Approved** | Full or partial compensation authorized |
| **Claim Denied** | Insufficient evidence or excluded damage |
| **Claim Disputed** | Referred to dispute resolution |
| **Claim Withdrawn** | Claimant withdraws the claim |

---

# SECTION 7
## Liability Allocation

**7.1 Kleanr's Role**

> **IMPORTANT ACKNOWLEDGMENT:**
>
> - Kleanr is a technology platform that connects Homeowners with Cleaners
> - Kleanr does NOT employ the Cleaners (they are independent contractors)
> - Kleanr does NOT supervise cleaning activities
> - Kleanr does NOT guarantee the quality of cleaning services
> - Kleanr facilitates damage claims but is NOT an insurer

**7.2 Cleaner Liability**

Independent Contractor Cleaners are responsible for:

- Damage caused by their negligent acts
- Damage caused by improper use of equipment
- Damage caused by failure to follow instructions
- Theft of property (criminal liability applies)

**7.3 Business Owner Liability**

Business Owners may be liable for:

- Damage caused by their employees
- Failure to properly train employees
- Providing defective equipment to employees
- Negligent supervision

**7.4 Homeowner Responsibility**

Homeowners are responsible for:

| Responsibility | Description |
|----------------|-------------|
| **Securing valuables** | Items over $500 should be secured |
| **Disclosing fragile items** | Note delicate items in booking |
| **Clearing hazards** | Remove tripping hazards, secure pets |
| **Accurate property description** | Honest representation of home condition |
| **Timely reporting** | Report damage within required timeframes |

**7.5 Shared Liability Scenarios**

In some cases, liability may be shared:

| Scenario | Allocation |
|----------|------------|
| **Homeowner left fragile item in cleaning path** | 50/50 or case-by-case |
| **Cleaner used wrong product on unmarked surface** | Case-by-case |
| **Pre-existing weakness caused item to break** | Reduced Cleaner liability |
| **Homeowner's instructions caused damage** | Homeowner liable |

---

# SECTION 8
## Compensation and Valuation

**8.1 Valuation Methods**

Damage compensation is calculated using:

| Method | Application |
|--------|-------------|
| **Actual Cash Value (ACV)** | Default method - market value minus depreciation |
| **Repair Cost** | When repair is possible and cost-effective |
| **Replacement Cost** | Only for items under 2 years old with receipt |

**8.2 Depreciation Schedule**

For Actual Cash Value calculations:

| Item Age | Depreciation |
|----------|--------------|
| **0-1 years** | 10% |
| **1-2 years** | 25% |
| **2-3 years** | 40% |
| **3-5 years** | 55% |
| **5-7 years** | 70% |
| **7-10 years** | 85% |
| **Over 10 years** | 90% (minimum 10% value) |

**8.3 Maximum Compensation Limits**

| Category | Per-Incident Limit |
|----------|-------------------|
| **Single item** | $2,500 |
| **Total per service** | $5,000 |
| **Annual per Homeowner** | $10,000 |
| **Electronics** | $1,000 per item |
| **Artwork/Antiques** | $2,500 (must be documented) |

**8.4 Compensation Methods**

Approved compensation may be provided via:

- Credit to Kleanr account
- Refund to original payment method
- Direct payment (for claims over $500)
- Repair service coordination

**8.5 Deductibles**

| Claim Value | Deductible |
|-------------|------------|
| **Under $100** | $0 |
| **$100 - $500** | $25 |
| **$500 - $2,500** | $50 |
| **Over $2,500** | $100 |

---

# SECTION 9
## Cleaner Insurance Requirements

**9.1 Required Coverage**

All Cleaners on the Kleanr platform must maintain:

| Coverage Type | Minimum Amount |
|---------------|----------------|
| **General Liability** | $1,000,000 per occurrence |
| **Property Damage** | $500,000 per occurrence |
| **Aggregate Annual** | $2,000,000 |

**9.2 Business Owner Requirements**

Business Owners must additionally maintain:

- Workers' compensation (where required by law)
- Employer's liability insurance
- Commercial auto (if using vehicles for business)

**9.3 Proof of Insurance**

Cleaners must:

- Upload current certificate of insurance to profile
- Maintain continuous coverage
- Update certificates before expiration
- Name Kleanr as additional insured (recommended)

**9.4 Uninsured Cleaners**

> **WARNING:** If a Cleaner fails to maintain required insurance:
>
> - Cleaner may be personally liable for all damages
> - Cleaner's account may be suspended
> - Homeowner recovery options may be limited
> - Kleanr bears no responsibility for uninsured losses

---

# SECTION 10
## Fraud Prevention

**10.1 Fraudulent Claims**

The following constitute claim fraud:

| Fraud Type | Example |
|------------|---------|
| **Fabricated damage** | Claiming damage that didn't occur |
| **Inflated claims** | Overstating damage value |
| **Pre-existing claims** | Claiming damage that existed before service |
| **Staged damage** | Intentionally causing damage to claim |
| **Multiple claims** | Filing same claim multiple times |
| **False documentation** | Submitting altered photos or receipts |

**10.2 Consequences of Fraud**

> **FRAUD CONSEQUENCES:**
>
> - Immediate denial of claim
> - Permanent account termination
> - Forfeiture of all account credits
> - Referral to law enforcement
> - Civil action for damages and costs
> - Reporting to fraud databases
> - Recovery of any compensation paid

**10.3 Fraud Investigation**

Kleanr reserves the right to:

- Conduct thorough fraud investigations
- Use image analysis technology
- Compare claims across accounts
- Require in-person inspection
- Engage third-party investigators
- Cooperate with law enforcement

**10.4 False Accusations**

Cleaners falsely accused of damage may:

- Provide evidence of innocence
- Request investigation review
- Seek account protection measures
- Pursue defamation claims against false accusers

---

# SECTION 11
## Dispute Resolution for Damage Claims

**11.1 Internal Review**

If you disagree with a claim decision:

| Step | Action | Timeframe |
|------|--------|-----------|
| **1** | Request review in writing | Within 7 days of decision |
| **2** | Provide additional evidence | With review request |
| **3** | Review conducted | Within 14 business days |
| **4** | Final internal decision | Within 21 business days |

**11.2 Mediation**

If internal review is unsatisfactory:

- Either party may request mediation
- Mediation is non-binding
- Costs split equally between parties
- Mediator selected from approved panel

**11.3 Binding Arbitration**

> **ARBITRATION AGREEMENT:**
>
> Any dispute not resolved through internal review or mediation shall be resolved by binding arbitration under the American Arbitration Association (AAA) Consumer Arbitration Rules.

**11.4 CLASS ACTION WAIVER**

> **YOU AGREE THAT ANY DAMAGE CLAIMS WILL BE RESOLVED ON AN INDIVIDUAL BASIS ONLY.**
>
> **YOU WAIVE ANY RIGHT TO PARTICIPATE IN A CLASS ACTION REGARDING DAMAGE CLAIMS.**

**11.5 Small Claims Court**

Either party may pursue claims in small claims court if:

- The claim amount qualifies under local rules
- The dispute is individual, not class-based

**11.6 Time Limit for Legal Action**

Any legal action regarding damage claims must be filed within ONE (1) YEAR of the incident, or the claim is permanently barred.

---

# SECTION 12
## Homeowner Best Practices

**12.1 Before Service**

To protect your property:

| Action | Benefit |
|--------|---------|
| **Photograph valuables** | Establishes pre-service condition |
| **Secure jewelry/cash** | Prevents loss claims |
| **Note fragile items in booking** | Alerts Cleaner to use care |
| **Clear walkways** | Prevents accidents |
| **Secure pets** | Prevents interference |
| **Disclose special surfaces** | Prevents product damage |

**12.2 During Service**

If you're present during service:

- Avoid hovering or micromanaging
- Point out areas of concern before cleaning begins
- Make yourself available for questions
- Note any incidents as they occur

**12.3 After Service**

Upon service completion:

- Walk through the home promptly
- Check for any damage immediately
- Report concerns before Cleaner leaves (if possible)
- Document any issues with photos
- Submit damage reports within 24 hours

**12.4 Documentation Recommendations**

We recommend Homeowners maintain:

> **RECOMMENDED RECORDS:**
>
> - Photos of valuable items (updated annually)
> - Receipts for items over $250
> - Appraisals for items over $2,500
> - Home inventory list
> - Video walkthrough before first service

---

# SECTION 13
## Limitation of Kleanr's Liability

**13.1 Platform Limitation**

> **KLEANR'S MAXIMUM LIABILITY:**
>
> Kleanr's total liability for any damage claims shall not exceed the LESSER of:
>
> - The amount paid for the specific cleaning service; OR
> - **One Thousand Dollars ($1,000)**

**13.2 No Consequential Damages**

Kleanr shall NOT be liable for:

- Indirect or consequential damages
- Lost profits or business interruption
- Emotional distress
- Punitive damages
- Any damages beyond actual property loss

**13.3 Third-Party Limitations**

Kleanr is not responsible for:

- Cleaner's failure to maintain insurance
- Cleaner's intentional misconduct
- Business Owner's employment practices
- Third-party service failures

**13.4 Force Majeure**

No liability applies for damages resulting from:

- Natural disasters
- Government actions
- Utility failures
- Pandemic or epidemic
- War or terrorism
- Other events beyond reasonable control

---

# SECTION 14
## Indemnification

**14.1 Homeowner Indemnification**

You agree to indemnify and hold harmless Kleanr from:

> **INDEMNIFIED CLAIMS:**
>
> - False or fraudulent damage claims
> - Claims arising from your failure to secure valuables
> - Claims arising from undisclosed hazards
> - Claims arising from your interference with service
> - Claims arising from your instructions to the Cleaner
> - Any misrepresentation in damage claims

**14.2 Cleaner Indemnification**

Cleaners agree to indemnify Kleanr from:

- Claims arising from their negligent acts
- Claims arising from theft or intentional damage
- Failure to maintain required insurance
- Violation of Cleaner agreements

---

# SECTION 15
## Privacy and Damage Claims

**15.1 Information Collection**

During damage claims, we may collect:

- Photographs of damage
- Photographs of your property
- Communication records
- Service records
- Payment information

**15.2 Information Sharing**

Damage claim information may be shared with:

| Recipient | Purpose |
|-----------|---------|
| **Cleaner/Business Owner** | Claim investigation |
| **Insurance companies** | Coverage claims |
| **Investigators** | Fraud prevention |
| **Legal counsel** | Dispute resolution |
| **Law enforcement** | Criminal matters |

**15.3 Record Retention**

Damage claim records are retained for:

- **Approved claims**: 7 years
- **Denied claims**: 5 years
- **Withdrawn claims**: 2 years
- **Fraud investigations**: 10 years

---

# SECTION 16
## Policy Modifications

**16.1 Right to Modify**

Kleanr reserves the right to modify this Damage Protection Policy at any time.

**16.2 Notice of Changes**

Material changes will be communicated via:

- Email notification
- In-app notification
- Posting on the Platform

**16.3 Effective Date of Changes**

- Material changes: 30 days after notice
- Non-material changes: Immediate
- Legal requirements: Immediate

**16.4 Acceptance of Changes**

Continued use of Kleanr services after changes become effective constitutes acceptance. If you disagree with changes, you must stop using the Platform.

---

# SECTION 17
## State-Specific Provisions

**17.1 California**

California residents have specific rights under the California Consumer Privacy Act regarding information collected in damage claims.

**17.2 New York**

New York residents: Nothing in this Policy limits your rights under New York General Business Law.

**17.3 Texas**

Texas residents: This Policy complies with Texas Deceptive Trade Practices Act requirements.

**17.4 Other States**

Additional state-specific provisions may apply based on your location.

---

# SECTION 18
## Contact Information

**18.1 Damage Claims**

| Contact | Details |
|---------|---------|
| **In-App** | Report Damage feature |
| **Email** | damage-claims@kleanr.com |
| **Response Time** | Within 24 hours |

**18.2 Disputes**

| Contact | Details |
|---------|---------|
| **Email** | damage-disputes@kleanr.com |
| **Response Time** | Within 48 hours |

**18.3 Legal Matters**

| Contact | Details |
|---------|---------|
| **Email** | legal@kleanr.com |
| **Address** | Kleanr, Inc. Legal Department |

---

# SECTION 19
## Acknowledgment

**19.1 Your Acknowledgment**

> **BY USING KLEANR'S SERVICES, YOU ACKNOWLEDGE THAT:**
>
> 1. You have read and understand this Damage Protection Policy
> 2. You agree to be bound by this Policy
> 3. Kleanr is a technology platform, NOT an insurer
> 4. Cleaners are independent contractors, NOT Kleanr employees
> 5. You understand the claims process and deadlines
> 6. You understand the coverage limitations and exclusions
> 7. You agree to the dispute resolution procedures
> 8. You agree to the liability limitations
> 9. You waive the right to participate in class actions for damage claims
> 10. You will secure valuable and fragile items before service

**19.2 Electronic Acceptance**

By clicking "I Accept" or using Kleanr services, you electronically sign and agree to this Damage Protection Policy with the same legal effect as a handwritten signature.

---

**END OF KLEANR HOMEOWNER DAMAGE PROTECTION POLICY**

*This document was last updated on February 18, 2026.*
*Version 1.0*
`,
        effectiveDate: now,
        pdfFilePath: null,
        pdfFileName: null,
        createdAt: now,
        updatedAt: now,
      },
    ]);
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.bulkDelete("TermsAndConditions", {
      type: "damage_protection",
    });
  },
};
