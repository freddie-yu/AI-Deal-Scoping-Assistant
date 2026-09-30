Table of Contents
Challenge Goal
Challenge Type
Target Users
Core User Journey
Functional Requirements
1. Customer Requirements Analysis
2. PRD and Functional Scope Generation
3. Cloud Solution Architecture
4. Data, Integration, and AI Solution Strategy
5. Effort, Timeline, Assumptions, and ROM Commercials
6. Integrated Scoping Package
Solution Depth Requirement
Grounding and Information Hierarchy
Primary Source: Customer Requirements
Secondary Source: User-Provided Assumptions and Configuration
AI-Generated Recommendations
Recommended Application Sections
1. Customer Requirements Workspace
2. PRD and Scope Workspace
3. Architecture Workspace
4. Data, Integration, and AI Workspace
5. Estimate Workspace
6. Final Scoping Package
AI and Model Usage
Technology Expectations
Deliverables
1. Working Application
2. Source Code
3. Seed Content
4. Automated Tests
5. README
6. Architecture Diagram
7. Demo Video
Evaluation Criteria
1. Requirements Analysis and Scope Model: 20%
2. PRD and Functional Scope: 15%
3. Cloud Solution Architecture: 15%
4. Data, Integration, and AI Strategy: 15%
5. Effort, Timeline, and ROM Estimation: 15%
6. Change Impact and Quality Validation: 10%
7. UX and Visual Design: 5%
5. Code Quality and Documentation: 5%
Total: 100%
Success Definition
Sales and delivery teams often receive customer requirements through RFPs, meeting notes, emails, discovery calls, or partially structured documents.

Turning this information into a complete solution proposal requires several activities:

Understanding and organizing the customer’s requirements
Identifying missing information and clarification questions
Producing a Product Requirements Document and functional scope
Designing a cloud-specific solution architecture
Defining the data and integration strategy
Recommending an appropriate AI solution approach
Estimating effort, timeline, assumptions, and rough-order-of-magnitude commercials
Checking consistency across all generated deliverables
This process is often manual, time-consuming, and dependent on experienced architects, delivery managers, business analysts, and subject matter experts.

This challenge is to build a browser-accessible AI Deal Scoping Assistant that transforms customer requirements into a structured, traceable, and reviewable solution-scoping package.

The application must provide more than a single prompt-to-document experience. It must create a structured scope model, allow users to review it, generate connected deliverables, explain the basis of estimates, identify inconsistencies, and support controlled updates when requirements or assumptions change.

The assistant must ground its outputs in:

Customer-provided requirements
User-reviewed assumptions and configurations
Clearly labeled AI-generated recommendations
The final product should feel like an intelligent solution-consulting workspace, not a generic chatbot, document summarizer, or automated quotation engine.

Challenge Goal
Build an AI-powered solution-scoping experience that enables users to:

Submit customer requirements
Extract a structured and traceable scope model
Review requirements, priorities, constraints, assumptions, and clarification questions
Generate a PRD and functional scope
Produce an end-to-end cloud-specific solution architecture
Define a data, integration, and AI solution strategy
Calculate effort, timeline, and ROM commercials using transparent estimation logic
Modify an important requirement or assumption and identify affected outputs
Validate requirement coverage and cross-document consistency
Generate and export an integrated solution-scoping package
The goal is to help sales, presales, architecture, and delivery teams move from unstructured customer requirements to a well-organized first draft of a solution proposal.

The generated output is an internal planning aid. It is not a final quotation, contractual commitment, architecture approval, or delivery guarantee.

Challenge Type
AI Exponential League Rapid Application Development Challenge

This challenge combines:

UX and UI design
Frontend development
AI-based requirement analysis
Structured scope management
PRD and functional-scope generation
Cloud solution architecture
Data and integration planning
AI solution design
Explainable effort and commercial estimation
Change-impact analysis
Cross-document consistency validation
Structured document generation
Participants may use an agentic workflow, multiple specialized AI agents, a single orchestrated AI service, or a custom lightweight workflow implementation.

Framework choice will not determine the score. Solutions will be evaluated based on requirement grounding, source traceability, quality of generated deliverables, architectural consistency, estimation transparency, change handling, user experience, and maintainability.

Target Users
1. Sales and Presales Teams

Users preparing an initial understanding of a customer opportunity and the proposed solution.

2. Solution Architects

Users designing the application, cloud, integration, data, security, and AI architecture.

3. Delivery Managers

Users review the proposed delivery approach, effort, dependencies, timeline, and risks.

4. Product and Business Analysts

Users converting customer needs into a structured PRD, functional scope, user journeys, and acceptance conditions.

5. Challenge and Engagement Managers

Users review how the proposed solution may be delivered through Topcoder challenges, delivery packages, or a blended engagement model.

Core User Journey
A typical user journey should be:

Create a new solution-scoping session.
Enter, paste, or upload customer requirements.
Review the customer context and normalized requirements.
Run AI-assisted requirement analysis.
Review structured requirements, source references, constraints, assumptions, and open questions.
Edit or approve the structured scope model.
Generate the PRD and functional scope from the reviewed scope.
Select a preferred cloud platform or request a recommendation.
Generate the solution, data, integration, and AI architecture.
Review the effort, timeline, estimation assumptions, and ROM commercials.
Review requirement coverage and consistency across all outputs.
Modify an important requirement, assumption, or configuration.
Review the affected outputs and regenerate or recalculate them.
Run a final quality check.
Export the complete solution-scoping package.
The experience should use clear and professional language such as:

Understand the customer need
Review the extracted scope
Clarify missing information
Approve the requirements
Generate the PRD
Design the solution
Plan the data flow
Select the AI approach
Estimate the delivery
Review change impact
Validate requirement coverage
Prepare the scoping package
Functional Requirements
1. Customer Requirements Analysis
The application must provide a browser-accessible interface where users can enter or upload customer requirements.

Supported input may include:

Plain text
Markdown
RFP content
Discovery-call notes
Business requirements
Technical requirements
Existing-system information
Document upload is recommended but not mandatory. If it is supported, commonly used readable formats such as PDF, DOCX, or TXT may be accepted.

The assistant must analyze the submitted content and identify:

Business objectives
Target users and personas
Functional requirements
Non-functional requirements
Existing systems
Integrations
Data requirements
Security and compliance expectations
Technology preferences
Delivery constraints
Dependencies
Risks
Missing information
Assumptions
Clarification questions
Requirements should use traceable identifiers such as:

BR_01
FR_01
NFR_01
INT_01
DATA_01
SEC_01
Each extracted item should identify:

Its structured ID
Its requirement type
Its description
Its priority
Its source text or source section
Whether it is customer-stated, AI-inferred, or assumed
Associated dependencies or open questions
Users must be able to review the analyzed scope before generating downstream deliverables. Editing the extracted requirements and assumptions is strongly recommended.

Constraints:

Each extracted requirement must retain a reference to the originating customer text and be classified as customer-stated, AI-inferred, or assumed.
Missing or ambiguous critical information must be surfaced through assumptions or clarification questions rather than silently invented.
2. PRD and Functional Scope Generation
The assistant must produce a structured Product Requirements Document and functional scope based on the analyzed customer requirements.

The generated PRD should include:

Product or solution overview
Business problem
Business objectives
Target users and personas
User journeys or key workflows
Functional requirements
Non-functional requirements
Integrations
Dependencies
Assumptions
Risks
Out-of-scope items
Open questions
Requirement traceability
The functional scope should organize requirements into logical:

Capabilities
Modules
Workstreams
Delivery packages
For example:

Capability: Customer Onboarding 

Included Requirements: 
FR_01, FR_02, INT_01 

Scope: 
Provide guided onboarding, identity verification, profile creation, and integration with the customer’s existing CRM. 

Priority: 
High 

Dependencies: 
Identity provider access and CRM API availability 
The assistant should distinguish between:

Customer-requested scope
AI-derived interpretation
Recommended enhancements
Assumptions requiring confirmation
Out-of-scope items
The application should provide a coverage view showing which requirements are covered by each capability or workstream.

Constraints:

Every major capability or functional-scope item must reference one or more reviewed requirement IDs.
The application must identify uncovered requirements and unsupported scope additions without requiring the reviewer to manually compare the complete documents.
3. Cloud Solution Architecture
The assistant must generate a proposed end-to-end solution architecture for at least one selected cloud platform:

Amazon Web Services
Microsoft Azure
Google Cloud Platform
The user should be able to:

Select a preferred cloud platform, or
Allow the assistant to recommend one based on the requirements
The architecture output should cover applicable areas such as:

User-facing applications
Backend services
APIs
Databases and storage
Identity and access management
Messaging and event processing
Integration components
AI and machine-learning services
Observability and monitoring
Security controls
Deployment and runtime approach
Development, test, and production environments
Availability and scalability
Backup and disaster recovery
The assistant should map logical components to relevant services from the selected cloud platform.

For example:

Logical Component:
Managed relational database

Selected Platform:
Microsoft Azure

Recommended Service:
Azure Database for PostgreSQL

Supported Requirements:
DATA_01, NFR_03, SEC_02

Rationale:
The solution requires managed PostgreSQL compatibility,
automated backups, encryption, and regional availability.

Assumption:
ASM_04: PostgreSQL is approved by the customer’s technology team.
The solution must provide an architecture diagram or another clear visual representation of the proposed design.

Each major architecture component should include:

Component name
Selected cloud service
Supported requirement IDs
Purpose
Selection rationale
Important trade-offs
Dependencies
Security considerations
Constraints:

The architecture must use services specific to the selected cloud platform and must not be limited to a generic list of technologies.
Every major architecture component must reference a customer requirement, non-functional requirement, security need, or reviewed assumption that justifies it.
4. Data, Integration, and AI Solution Strategy
The assistant must generate coordinated data, integration, and AI solution strategy.

Data Strategy

The data strategy should cover applicable areas such as:

Major data domains
Data sources
Data ownership
Data ingestion
Transactional and analytical storage
Data quality
Metadata and governance
Data retention
Privacy and security
Reporting and analytics
Backup and recovery
Integration Architecture

The integration architecture should identify:

Internal systems
External systems
APIs
Events or messages
Batch integrations
File exchanges
Authentication approach
Error handling
Retry behavior
Monitoring
Data synchronization considerations
The solution should describe how information moves between major architecture components and external systems.

AI Solution Approach

The AI strategy should identify:

Suitable AI use cases
AI-specific requirements
Areas where deterministic processing is more appropriate
Recommended AI architecture pattern
Model or provider options
Retrieval requirements, when applicable
Agent or workflow orchestration, when applicable
Prompt and structured-output management
Evaluation approach
Responsible-AI and safety considerations
Monitoring and feedback
Human-review requirements
Data privacy considerations
The assistant should recommend appropriate frameworks or services. Examples may include:

Mastra
LangChain
LangGraph
Semantic Kernel
Vercel AI SDK
Spring AI
Managed cloud AI services
Custom orchestration
Recommendations should explain why the proposed framework or service is suitable. The output should not simply list popular technologies.

Constraints:

Every major integration and AI use case must reference relevant reviewed requirements and appear in the corresponding solution design or coverage view.
Framework and service recommendations must include a solution-specific rationale and distinguish AI functions from deterministic rules and mandatory human decisions.
5. Effort, Timeline, Assumptions, and ROM Commercials
The assistant must produce an initial delivery estimate for the proposed solution.

The estimate should include:

Delivery phases
Major workstreams
Roles or skill categories
Effort range
Timeline range
Major milestones
Dependencies
Assumptions
Delivery risks
ROM commercial range
Confidence level
A possible delivery plan could include:

Phase 1: Discovery and Architecture 
Phase 2: Experience and Core Platform 
Phase 3: Data and Integration 
Phase 4: AI Capabilities 
Phase 5: Testing and Hardening 
Phase 6: Deployment and Handover 
The estimate should consider configurable factors such as:

Number and complexity of functional capabilities
Number and complexity of integrations
Cloud infrastructure complexity
Data migration or transformation needs
AI-use-case complexity
Security and compliance needs
Testing requirements
Required environments
Team composition
Role-based rates
Productivity assumptions
Contingency percentage
Delivery dependencies
The AI may:

Identify workstreams
Suggest complexity levels
Recommend roles and skills
Identify risks and dependencies
Explain the estimate
The final effort, timeline, and ROM values must be produced from visible estimation factors or documented calculation rules. They must not be accepted as unsupported LLM-generated numbers.

For example:

Workstream:
Data and Integration

Requirements:
DATA_01, INT_01, INT_02

Complexity:
High

Estimated Effort:
18 to 24 person-weeks

Estimate Drivers:
Three external integrations, data migration, validation,
error recovery, and reconciliation.

Commercial Basis:
Effort × configured blended rate + contingency

Confidence:
Medium

Confidence Limitation:
External API readiness has not been confirmed.
If required inputs are missing, the application must:

Reduce the confidence level
Identify the missing information
Show which estimate components are affected
Avoid presenting unsupported precision
Historical Topcoder project data may be displayed separately as contextual information. It must not silently replace the current solution’s scope-based estimation logic.

Constraints:

Effort, timeline, and ROM values must be reproducible from visible scope factors, rates, assumptions, contingency, currency, or documented calculation rules.
Missing estimation inputs must reduce confidence or block the affected calculation rather than being silently replaced with unsupported values.
6. Integrated Scoping Package
The assistant must combine the generated outputs into a consistent solution-scoping package.

The package should contain:

Executive summary
Customer objectives
Requirement summary
PRD
Functional scope
Solution architecture
Architecture diagram
Data strategy
Integration architecture
AI solution approach
Recommended technologies and frameworks
Delivery phases and workstreams
Effort and timeline estimate
ROM commercials
Assumptions
Risks
Dependencies
Open questions
Requirement coverage
Traceability information
Change-Impact Handling

The application must allow the user to modify at least one reviewed requirement, assumption, or configuration.

Possible changes include:

Cloud platform
Expected user volume
Requirement priority
Delivery deadline
Integration complexity
Security requirement
AI-provider preference
Rate card
Contingency
Scope inclusion or exclusion
The application must identify which outputs are affected by the change.

For example:

Change:
Expected users increased from 5,000 to 500,000.

Affected Areas:
* NFR_02, NFR_04
* Scalability architecture
* Caching strategy
* Database sizing
* Performance testing
* Cloud cost assumptions
* Delivery effort
* ROM estimate

Unaffected Areas:
* Customer personas
* Core onboarding workflow
* Existing CRM integration
The user should be able to regenerate or recalculate the affected sections without silently replacing reviewed and unaffected content.

Quality Gate

Before export, the application should check:

Coverage of high-priority requirements
Uncovered requirements
Unsupported scope additions
Architecture components without requirement justification
Integrations missing from the delivery plan
AI use cases missing evaluation, privacy, safety, or human-review considerations
Missing estimation inputs
Unresolved clarification questions
Conflicting cloud selections or technologies
Estimate or commercial inconsistencies
Assumptions requiring human validation
The quality summary may include:

Requirement Coverage: 92%
Uncovered Requirements: 2
Unresolved Questions: 4
Unsupported Recommendations: 1
Estimate Confidence: Medium
Export Status: Review Required
The package should be viewable in the application and exportable in at least one readable format, such as Markdown, PDF, or DOCX.

Every exported package must contain the following statement:

This document is an AI-assisted internal planning output based on customer requirements and stated assumptions. It requires review and validation by qualified sales, architecture, delivery, security, and commercial stakeholders. It is not a final quote, contractual commitment, or delivery guarantee.

Constraints:

Users must be able to modify at least one reviewed requirement or major assumption and see which scope, architecture, strategy, effort, or commercial outputs are affected.
The final package must identify uncovered requirements, unresolved questions, unsupported recommendations, estimation gaps, inconsistencies, and items requiring human validation before export.
Solution Depth Requirement
The submission must provide more than a single prompt-to-document experience.

At minimum, the solution must demonstrate:

A structured and reviewable scope model
Source traceability at requirement level
User review before downstream generation
Multiple connected deliverables
Requirement-to-output traceability
Explainable and reproducible estimation logic
Change-impact handling
Cross-document coverage and consistency validation
A pre-export quality gate
A solution that sends the complete customer requirements to an AI model and displays a generated report will not satisfy the challenge, even if the report contains all requested sections.

Using multiple prompts alone is also insufficient unless the generated outputs are connected through a shared and reviewable scope model.

Grounding and Information Hierarchy
The assistant must follow a clear information hierarchy when producing its outputs.

Primary Source: Customer Requirements
The customer-provided requirements are the primary source for:

PRD
Functional scope
Architecture
Data strategy
Integration design
AI solution approach
Delivery plan
Effort and timeline estimate
ROM commercials
Secondary Source: User-Provided Assumptions and Configuration
The assistant may use clearly identified information such as:

Preferred cloud platform
Expected user volume
Target regions
Delivery deadlines
Team structure
Rate cards
Security requirements
Regulatory constraints
Productivity factors
Contingency
User-reviewed assumptions
AI-Generated Recommendations
AI-derived recommendations must be clearly labeled and supported by:

Customer requirements
Architecture rationale
Known constraints
Explicit assumptions
User configuration
Where sufficient information is unavailable, the assistant must:

Generate clarification questions
Record an assumption requiring review
Reduce the confidence level
Mark the affected output as requiring validation
Recommended Application Sections
Participants may design their own interface, but the following sections are recommended.

1. Customer Requirements Workspace
Requirements input or document upload
Customer and opportunity context
Normalized content preview
Structured scope model
Source references
Assumptions
Dependencies
Missing information
Clarification questions
Review and update controls
2. PRD and Scope Workspace
Business objectives
Personas
User journeys
Functional scope
Non-functional requirements
Scope boundaries
Recommended enhancements
Requirement coverage
3. Architecture Workspace
Cloud-platform selection
Architecture diagram
Application components
Cloud services
Security and deployment
Architecture rationale
Trade-offs
Requirement traceability
4. Data, Integration, and AI Workspace
Data domains and flows
Integration inventory
Data and integration diagram
AI use cases
AI architecture
Framework recommendations
Evaluation approach
Responsible-AI considerations
5. Estimate Workspace
Delivery phases
Workstreams
Roles and skills
Complexity drivers
Effort range
Timeline and milestones
Rate configuration
ROM commercials
Assumptions
Confidence indicators
6. Final Scoping Package
Change-impact summary
Requirement-coverage view
Cross-document consistency checks
Risks and unresolved questions
Quality-gate status
Integrated package preview
Export controls
A highly complex enterprise interface is not required. A focused, clear, and well-designed end-to-end experience is preferred.

AI and Model Usage
The solution must include meaningful AI functionality.

AI functionality may include:

Requirement extraction
Requirement classification
Missing-information detection
Clarification-question generation
PRD generation
Functional decomposition
Architecture recommendation
Data-strategy generation
Integration analysis
AI-use-case identification
Framework recommendation
Delivery-plan generation
Assumption and risk identification
Change-impact explanation
Scoping-package generation
Consistency and requirement-coverage review
Participants may use:

Free-tier AI providers
Local or open-source models
Mock AI providers
Recorded sample responses
Multi-agent architectures
Workflow-based orchestration
Structured generation
Paid AI access must not be required to run or review the submission.

If a live AI provider is unavailable, the complete seeded demonstration must remain available through a clearly labeled mock mode.

Mock responses should preserve the same:

Requirements-analysis flow
Structured scope model
Source traceability
PRD and architecture structure
Data and AI recommendations
Estimation logic
Change-impact behavior
Quality validation
Final-package generation
The solution should validate important structured AI outputs before using them in later stages.

Technology Expectations
The technology stack is flexible.

Participants may use:

JavaScript or TypeScript
Python
Java
.NET
Existing AI or agent frameworks
Custom orchestration
Vector or semantic retrieval
Diagramming libraries
Document-export libraries
Possible AI frameworks include:

Mastra
Vercel AI SDK
LangChain
LangGraph
Semantic Kernel
Spring AI
Custom TypeScript or Python orchestration
Using one of these frameworks is not mandatory.

The solution should be:

Browser-accessible
Runnable locally
Responsive and visually clear
Independent of mandatory paid services
Maintainable and well documented
Secure in its handling of customer requirements
Transparent about sources, assumptions, and AI-generated content
Authentication is optional. If implemented, working reviewer credentials must be provided.

Deliverables
1. Working Application
The submission must include:

Customer-requirements input
Structured requirement analysis
Scope review or update
PRD and functional-scope generation
Cloud-specific architecture generation
Architecture visualization
Data and integration strategy
AI solution approach
Framework recommendations
Explainable effort and timeline estimation
Reproducible ROM commercial calculation
Change-impact handling
Coverage and consistency validation
Integrated solution-scoping package
Mock AI mode
2. Source Code
The source code should be:

Clean
Modular
Documented
Easy to run locally
Clearly separated by responsibility
Recommended separation includes:

User interface
Document-ingestion layer
AI orchestration
Requirement analysis
Scope-model management
PRD and scope generation
Architecture generation
Data and integration planning
AI solution planning
Estimation logic
Traceability management
Change-impact analysis
Quality validation
Document export
Mock AI provider
3. Seed Content
The repository must include:

Sample customer requirements
Sample customer and opportunity context
Configurable estimation assumptions
Example role-based rates
Example commercial configuration
Mock AI responses
Expected structured-output schemas
Expected document structures
The seed content should support at least:

One application-modernization scenario
One data or integration-heavy scenario
One AI-enabled solution scenario
One scenario with important missing information
4. Automated Tests
Automated tests should cover applicable areas such as:

Structured AI-output validation
Requirement traceability
Requirement-coverage checks
Unsupported-recommendation detection
Effort calculation
ROM commercial calculation
Rate and contingency changes
Missing estimation inputs
Change-impact identification
Cross-document consistency checks
5. README
The README must explain:

How to run the application locally
How to configure an optional AI provider
How mock AI mode works
How customer requirements are processed
How the scope model is produced and reviewed
How source traceability is maintained
How the PRD and architecture are generated
How data, integration, and AI recommendations are produced
How effort and timeline are estimated
How ROM commercials are calculated
How change-impact analysis works
How consistency and coverage are checked
How customer data is stored or protected
Architecture, assumptions, and known limitations
6. Architecture Diagram
The submission architecture diagram should show:

Browser application
Requirements-ingestion layer
AI orchestration layer
Structured scope model
PRD and scope generator
Cloud-architecture generator
Data and integration strategy generator
AI solution generator
Estimation component
Traceability component
Change-impact component
Quality-validation component
Export or document-generation layer
Mock AI provider
7. Demo Video
Recommended duration: 3 to 5 minutes.

The video should demonstrate:

Entering or uploading customer requirements
Reviewing extracted requirements and source references
Reviewing assumptions and missing information
Updating or approving the scope model
Generating the PRD and functional scope
Selecting or recommending a cloud platform
Reviewing the solution architecture
Reviewing the data, integration, and AI strategy
Viewing the effort, timeline, and ROM calculation basis
Reviewing requirement coverage and traceability
Changing one important requirement or assumption
Viewing the affected outputs and updated estimate
Running the pre-export quality check
Exporting the final scoping package
Running the application in mock AI mode
A public video link may be provided in the README or submission of notes.

Evaluation Criteria
1. Requirements Analysis and Scope Model: 20%
Scoring will consider:

Accuracy of requirement extraction
Source-text traceability
Classification of customer-stated, inferred, and assumed information
Missing-information detection
Clarification questions
Scope review or update
Structured and reusable requirement model
2. PRD and Functional Scope: 15%
Scoring will consider:

Quality and completeness of the PRD
Functional-scope organization
Requirement-to-capability traceability
Separation of requested scope and recommendations
Coverage of functional and non-functional requirements
Identification of unsupported additions
3. Cloud Solution Architecture: 15%
Scoring will consider:

Cloud-specific service selection
Completeness of the end-to-end architecture
Requirement-to-component traceability
Security, scalability, observability, and deployment considerations
Architecture rationale and trade-offs
Quality of the architecture visualization
4. Data, Integration, and AI Strategy: 15%
Scoring will consider:

Quality of the data strategy
Completeness of the integration architecture
Suitability of AI use cases
Quality of framework and service recommendations
Separation of AI and deterministic processing
Responsible-AI, privacy, evaluation, and human-review considerations
5. Effort, Timeline, and ROM Estimation: 15%
Scoring will consider:

Logical delivery phases and workstreams
Visible scope and complexity drivers
Reproducible estimation logic
Configurable commercial assumptions
Rate, contingency, and currency handling
Confidence indicators
Risks, dependencies, exclusions, and assumptions
6. Change Impact and Quality Validation: 10%
Scoring will consider:

Identification of affected outputs after a change
Preservation of unaffected reviewed content
Requirement-coverage checks
Cross-document consistency checks
Detection of unresolved questions and unsupported recommendations
Quality-gate status before export
7. UX and Visual Design: 5%
Scoring will consider:

Clear end-to-end user journey
Ease of reviewing structured requirements
Readability of generated outputs
Quality of diagrams and traceability views
Responsive and professional design
5. Code Quality and Documentation: 5%
Scoring will consider:

Maintainable architecture
Structured AI-output validation
Error handling
Secure configuration
Local setup reliability
Automated tests
Mock-mode support
README and architecture documentation
Total: 100%
Success Definition
A successful submission allows an evaluator to:

Open the application in a browser.
Enter or upload customer requirements.
Review extracted requirements and their source references.
Distinguish customer-stated content from assumptions and recommendations.
Review missing information and clarification questions.
Update or approve the structured scope.
Generate a customer-grounded PRD.
Review the functional scope and requirement coverage.
Select AWS, Azure, or Google Cloud.
Review a cloud-specific solution architecture.
Trace architecture components to requirements or assumptions.
Review the data and integration strategy.
Review the proposed AI solution approach.
Understand why frameworks or services were recommended.
Review effort, timeline, delivery phases, and milestones.
Reproduce the ROM estimate from visible configuration and calculation factors.
Identify low-confidence areas and missing estimation inputs.
Modify an important requirement or assumption.
Review the resulting impact on connected deliverables.
Run requirement-coverage and consistency checks.
Review unresolved issues before export.
Export a complete solution-scoping package.
Run the complete seeded experience without paid AI access.