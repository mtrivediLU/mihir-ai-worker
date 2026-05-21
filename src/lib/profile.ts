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
  name: "Mihir Trivedi",
  role: "Business Intelligence Developer · Data & AI Engineer",
  availability:
    "Actively interviewing, open to remote roles across Canada or relocation within Canada.",
  contact: {
    email: "mtrivedi@laurentian.ca",
    phone: "249-360-5901",
    linkedin: "https://www.linkedin.com/in/mihirtrivedigm/",
  },
  summary:
    "BI Developer and Data Engineer with 8+ years of experience across healthcare, mining, e-commerce, and the public sector. Builds centralized data warehouses, ELT pipelines, AI integrations, and cross-functional dashboards. Expert in Python, PostgreSQL, dbt, Power BI, Tableau, and Azure/AWS/GCP.",
  skills: [
    "Python", "PostgreSQL", "dbt", "SQL Server", "T-SQL",
    "Power BI", "Tableau", "Azure", "AWS", "GCP",
    "Salesforce", "HubSpot", "SAP Commerce Cloud (Hybris)",
    "Java Spring MVC", "TypeScript", "React Native",
    "Power Platform", "Power Apps", "Power Automate",
    "OpenAI API", "Gemini", "Cloudflare Workers",
    "ETL/ELT", "Data Warehousing", "SSIS", "ArcGIS", "REST APIs",
  ],
  experience: [
    {
      role: "Business Intelligence Developer",
      company: "Flosonics Medical",
      period: "Oct 2024 – Apr 2026",
      location: "Toronto, ON (Remote)",
      highlights: [
        "Architected Enterprise Data Warehouse using PostgreSQL and dbt, unifying sales, production, and HR data.",
        "Engineered Generative AI assistant (OpenAI + Gemini) enabling plain-English queries across all data sources.",
        "Built ELT pipelines integrating Salesforce, HubSpot, ZoomInfo, and device logs; automated Tableau reporting.",
      ],
    },
    {
      role: "Software Development Consultant",
      company: "LoopX",
      period: "Jun 2024 – Jul 2025",
      location: "Sudbury, ON",
      highlights: [
        "Built real-time safety dashboards for underground mining operations (Cementation partnership).",
        "Owned full end-to-end delivery: backend, frontend, and production deployment.",
      ],
    },
    {
      role: "Business Intelligence Analyst",
      company: "City of Greater Sudbury",
      period: "May 2024 – Aug 2024",
      location: "Sudbury, ON",
      highlights: [
        "Integrated third-party vendor with SQL Server via SSIS, Python, and Google Cloud SQL Auth Proxy.",
        "Supported 911 and opioid-response reporting; built Service-Based Budgeting dashboards in Power BI.",
      ],
    },
    {
      role: "Lead Software Developer",
      company: "Minax Inc.",
      period: "Oct 2023 – May 2024",
      location: "Sudbury, ON",
      highlights: [
        "Led delivery of offline-first mobile ground-control app for Vale using Microsoft Power Platform.",
        "Automated Workplace Safety North forms via Power Automate, cutting reporting time from ~5 hours to minutes.",
      ],
    },
    {
      role: "Consulting Software Developer",
      company: "Creative GOAT",
      period: "Contract",
      location: "Sudbury, ON",
      highlights: [
        "Built Power Apps mobile work-order app for Northern Equipment & Crane Rentals.",
        "WordPress optimization for RufDiamond LTD contributed to a 3x increase in sales volume.",
      ],
    },
    {
      role: "Research Associate (Data & ML)",
      company: "Mineral Exploration Research Centre (MERC)",
      period: "Mar 2022 – Jul 2023",
      location: "Sudbury, ON",
      highlights: [
        "Applied ML to geological datasets, producing gold prospectivity maps with a 99.5% F1 score.",
        "Spatial analysis using ArcGIS and QGIS for mineralization probability assessment.",
      ],
    },
    {
      role: "Teaching Assistant",
      company: "Laurentian University",
      period: "Sep 2021 – Jul 2024",
      location: "Sudbury, ON",
      highlights: [
        "Assisted students in Cyber Crime, Java, C++, and App Development courses.",
      ],
    },
    {
      role: "Lead Software Engineer",
      company: "Tata Consultancy Services (TCS)",
      period: "Nov 2017 – Oct 2021",
      location: "Mumbai, India",
      highlights: [
        "Led team of 4 maintaining Edgepark.com, a high-traffic B2C medical supply e-commerce platform (Java Spring MVC + Hibernate).",
        "Deployed 13 B2B e-commerce platforms across Europe and North America for Saint-Gobain Abrasives using SAP Hybris.",
        "Built REST integrations for payments, inventory management, and third-party logistics providers.",
      ],
    },
  ],
  education: [
    {
      degree: "Master of Computational Science",
      institution: "Laurentian University, Canada",
      years: "2021 – 2023",
      notes: [
        "Thesis: ML for Geological Discovery",
        "Oral presentation at AICMSE 2023, Harvard Faculty Club",
        "Co-authored publication in Ore Geology Reviews (2023)",
      ],
    },
    {
      degree: "Bachelor of Computer Engineering",
      institution: "Gujarat Technological University, India",
      years: "2013 – 2017",
    },
  ],
  certifications: [
    { name: "AZ-305: Designing Azure Infrastructure Solutions", issuer: "Microsoft", year: "2024" },
    { name: "Azure Fundamentals (AZ-900)", issuer: "Microsoft", year: "2024", credentialId: "C669A77F8F67FB6D" },
    { name: "Power BI Data Analyst Associate (PL-300)", issuer: "Microsoft", year: "2024", credentialId: "982D4E48445B5F5D" },
    { name: "Power Platform Developer Associate (PL-400)", issuer: "Microsoft", year: "2024", credentialId: "E94F1B4F03BC2E34" },
    { name: "Salesforce Certified Agentforce Specialist (AI-201)", issuer: "Salesforce", year: "2025", credentialId: "7292670" },
  ],
  publications: [
    "Co-author: 'A study of faults in the Superior province of Ontario and Quebec using random forest ML: Spatial relationship to gold mines,' Ore Geology Reviews, 2023. DOI: 10.1016/j.oregeorev.2023.105403",
    "Speaker: 'Machine Learning for Predictive Modeling of Mineral Deposits,' AICMSE 2023, Harvard Faculty Club.",
  ],
  faqs: [
    {
      question: "What is Mihir's current availability?",
      answer:
        "Mihir is actively interviewing and available immediately. He is open to remote roles across Canada or relocation within Canada.",
    },
    {
      question: "What are Mihir's core technical strengths?",
      answer:
        "Data engineering (PostgreSQL, dbt, ETL/ELT, SQL Server), business intelligence (Power BI, Tableau), AI integrations (OpenAI, Gemini), cloud platforms (Azure, AWS, GCP), and full-stack development (Java, TypeScript, SAP Commerce Cloud).",
    },
    {
      question: "What type of role is Mihir looking for?",
      answer:
        "Business Intelligence Developer, Data Engineer, Software Developer, or Business Analyst roles — ideally leveraging data, AI, and analytics to drive business decisions.",
    },
    {
      question: "What industries has Mihir worked in?",
      answer:
        "Healthcare/MedTech (Flosonics Medical), mining technology (LoopX, MERC, Minax), municipal government (City of Greater Sudbury), enterprise e-commerce (TCS — Saint-Gobain, Edgepark), and startups/consulting.",
    },
    {
      question: "Does Mihir have AI and machine learning experience?",
      answer:
        "Yes. At Flosonics he built a production GenAI assistant using OpenAI and Gemini APIs. At MERC he applied ML to geological datasets achieving a 99.5% F1 score and presented at Harvard.",
    },
    {
      question: "What certifications does Mihir hold?",
      answer:
        "5 active credentials: Microsoft AZ-305 (Azure Infrastructure), AZ-900 (Azure Fundamentals), PL-300 (Power BI Analyst), PL-400 (Power Platform Developer), and Salesforce Agentforce Specialist (AI-201).",
    },
    {
      question: "Can you summarize Mihir's most recent role?",
      answer:
        "At Flosonics Medical (Oct 2024 – Apr 2026), Mihir architected the Enterprise Data Warehouse using PostgreSQL and dbt, built a GenAI assistant for plain-English data queries, and automated ELT pipelines integrating Salesforce, HubSpot, and device telemetry.",
    },
    {
      question: "How many years of experience does Mihir have?",
      answer:
        "8+ years total: 4+ years in Canada specializing in BI and data engineering, and 4 years as Lead Software Engineer at TCS in India delivering enterprise e-commerce platforms.",
    },
  ],
};

export const PROFILE_TEXT = JSON.stringify(PROFILE);
