export interface Experience {
  role: string;
  company: string;
  period: string;
  location: string;
  highlights: string[];
}

export interface Education {
  degree: string;
  institution: string;
  years: string;
  notes?: string[];
}

export interface Certification {
  name: string;
  issuer: string;
  year: string;
  credentialId?: string;
}

export interface FAQ {
  question: string;
  answer: string;
}

export interface Profile {
  name: string;
  role: string;
  availability: string;
  contact: { email: string; phone: string; linkedin: string };
  summary: string;
  skills: string[];
  experience: Experience[];
  education: Education[];
  certifications: Certification[];
  publications: string[];
  faqs: FAQ[];
}

export const PROFILE: Profile = {
  "name": "Mihir Trivedi",
  "role": "Data & Analytics Consultant",
  "availability": "Contact Mihir directly to discuss availability, a role or a project. No current availability or job-search status is published.",
  "contact": {
    "email": "mtrivedi@laurentian.ca",
    "phone": "",
    "linkedin": "https://www.linkedin.com/in/mihirtrivedigm/"
  },
  "summary": "Toronto-based technology professional with industry experience since 2017. His work spans business intelligence, analytics engineering, data systems, applied AI and automation, research and public speaking. This experience includes employed and contract roles; it is not a claim of independent consulting tenure.",
  "skills": [
    "Python",
    "SQL",
    "PostgreSQL",
    "dbt",
    "SQL Server",
    "SSIS",
    "Power BI",
    "DAX",
    "Tableau",
    "Power Apps",
    "Power Automate",
    "Dataverse",
    "Java",
    "Spring MVC",
    "Hibernate",
    "SAP Commerce Cloud",
    "REST APIs",
    "TypeScript",
    "Cloudflare Workers",
    "Workers AI",
    "D1",
    "KV",
    "Azure",
    "Google Cloud",
    "OpenAI API",
    "Gemini API",
    "ArcGIS",
    "QGIS"
  ],
  "experience": [
    {
      "role": "Data engineering and BI",
      "company": "A medical device organization",
      "period": "",
      "location": "",
      "highlights": [
        "Built a PostgreSQL and dbt warehouse, ELT pipelines and reporting with Python, SQL, Tableau and Power BI. Also worked on a plain-language data assistant."
      ]
    },
    {
      "role": "Operational analytics",
      "company": "Mining technology",
      "period": "",
      "location": "",
      "highlights": [
        "Built and deployed dashboards and automated operational reporting using Python, JavaScript and PostgreSQL."
      ]
    },
    {
      "role": "Municipal reporting",
      "company": "An Ontario municipality",
      "period": "",
      "location": "",
      "highlights": [
        "Integrated vendor data with SQL Server using SSIS, Python and Cloud SQL Auth Proxy, and developed Power BI reporting."
      ]
    },
    {
      "role": "Field automation",
      "company": "Mining services",
      "period": "",
      "location": "",
      "highlights": [
        "Led delivery of an offline-first Power Apps inspection workflow using Dataverse and Power Automate, including requirements, testing, documentation and handover."
      ]
    },
    {
      "role": "Research",
      "company": "Laurentian University",
      "period": "",
      "location": "",
      "highlights": [
        "Applied random forest models and spatial analysis to regional geological data, contributing to published research."
      ]
    },
    {
      "role": "Software engineering",
      "company": "Enterprise e-commerce",
      "period": "",
      "location": "",
      "highlights": [
        "Built Java services and REST integrations for enterprise e-commerce platforms across Europe and North America."
      ]
    }
  ],
  "education": [
    {
      "degree": "MSc, Computational Sciences",
      "institution": "Laurentian University",
      "years": "2021–2023",
      "notes": [
        "Co-authored research in Ore Geology Reviews (2023)."
      ]
    },
    {
      "degree": "BE, Computer Engineering",
      "institution": "Gujarat Technological University",
      "years": "2013–2017"
    }
  ],
  "certifications": [
    {
      "name": "Azure Fundamentals (AZ-900)",
      "issuer": "Microsoft",
      "year": "2024"
    },
    {
      "name": "Power BI Data Analyst Associate (PL-300), certification earned; current status must be checked with issuer",
      "issuer": "Microsoft",
      "year": "2024"
    },
    {
      "name": "Power Platform Developer Associate (PL-400), certification earned; current status must be checked with issuer",
      "issuer": "Microsoft",
      "year": "2024"
    },
    {
      "name": "Designing Microsoft Azure Infrastructure Solutions (AZ-305), exam passed, not an Azure Solutions Architect Expert certification",
      "issuer": "Microsoft",
      "year": "2024"
    },
    {
      "name": "Agentforce Specialist",
      "issuer": "Salesforce",
      "year": "2025"
    },
    {
      "name": "The Fundamentals of OCAP®, course completion, not a professional certification",
      "issuer": "First Nations Information Governance Centre",
      "year": "2026"
    }
  ],
  "publications": [
    "Co-author of A study of faults in the Superior province of Ontario and Quebec using the random forest machine learning algorithm: Spatial relationship to gold mines, Ore Geology Reviews (2023), DOI: 10.1016/j.oregeorev.2023.105403.",
    "Oral presentation at AICMSE 2023, Harvard Faculty Club. This does not imply Harvard affiliation.",
    "Alumni address at Laurentian University convocation, June 2025.",
    "Sudbury DevFest talk on AI and industrial automation."
  ],
  "faqs": [
    {
      "question": "How can I contact Mihir?",
      "answer": "Email mtrivedi@laurentian.ca or connect through his public LinkedIn profile."
    },
    {
      "question": "Is Mihir available for a role or a project?",
      "answer": "Please contact Mihir directly. Current availability and employment details are not published in this portfolio."
    },
    {
      "question": "How long has Mihir worked in technology?",
      "answer": "Since 2017, across software engineering, data and analytics. This is industry experience, not independent consulting tenure."
    }
  ]
};

export const PROFILE_TEXT = JSON.stringify(PROFILE);
