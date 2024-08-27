import React from "react";
import './Resume.css';

const Resume = () => {
  return (
    <div className="container">
      <h1>Thomas McNair Bledsoe</h1>
      <h3>Software Developer</h3>
      <p style={{ textAlign: 'center' }}>Greenville, SC | tmcnairbledsoe@gmail.com | 864-804-9796</p>
      
      <section>
        <h2>Professional Summary</h2>
        <p>
          Seasoned software developer with proven skills in C#, .Net Framework, .Net Core, SQL, Azure, NoSQL, Python, ReactJS,
          Angular, Node, R, WPF, MVC, HTML, CSS, and JavaScript. Experienced in maintaining existing systems and
          designing new applications across various technologies and programming philosophies. Adept at collaborating
          with team leaders to innovate and automate workflows, reducing human error and improving efficiency. 
        </p>
        <p>
          Expertise in creating and deploying applications on Azure, developing solutions for fixed income trading teams,
          and creating or enhancing large-scale web applications. Extensive experience with enterprise-level systems, cloud
          platforms, and modern development practices.
        </p>
      </section>

      <section>
        <h2>Professional Experience</h2>

        <h3>Software Developer - Metromont, Greenville, SC (Aug 2023 - Aug 2024)</h3>
        <ul>
          <li>Created .NET Core 8 C# applications using Autodesk Platform Services.</li>
          <li>Developed Python scripts for automation tasks and maintained Revit Addins.</li>
          <li>Utilized Azure Portal features including SQL Databases, Function Apps, Logic Apps, Storage Accounts, Key Vault, and Cosmos DB.</li>
          <li>Designed and maintained Azure Functions for automating project lifecycle tasks.</li>
          <li>Implemented SSO using Active Directory and Entra ID.</li>
          <li>Published and maintained self-refreshing Power BI reports tracking enterprise application usage.</li>
        </ul>

        <h3>Senior Software Developer - Grace Hill, Greenville, SC (Apr 2021 - Aug 2023)</h3>
        <ul>
          <li>Maintained web portal for real estate management clients and internal tools.</li>
          <li>Led a team to develop new pages and features for a complex user and tenant system.</li>
          <li>Developed React micro front-end components and a new React application for survey comparison using Qualtrics data.</li>
          <li>Maintained and enhanced numerous .NET Core applications.</li>
        </ul>

        <h3>Web Application Developer - RealPage Contact Center, Greenville, SC (May 2020 - Mar 2021)</h3>
        <ul>
          <li>Developed and supported applications for Call Center operations including automation and reporting tools.</li>
          <li>Created core RESTful APIs to decouple SQL calls from legacy systems.</li>
          <li>Refactored legacy ASP.NET code into modern ReactJS applications.</li>
          <li>Designed a new external client dashboard using ReactJS.</li>
        </ul>

        <h3>Web Application Developer - Cass Information Systems, Greenville, SC (Dec 2019 - Mar 2020)</h3>
        <ul>
          <li>Developed and maintained ASP.NET applications for enterprise and customer-facing sites.</li>
          <li>Managed requirements using DevOps ticketing and Agile methodologies.</li>
          <li>Facilitated SSO connections for external customers and created documentation for new features.</li>
        </ul>

        <h3>Software Developer - Barings, Charlotte, NC (Dec 2018 - May 2019)</h3>
        <ul>
          <li>Collaborated with fixed income trading teams using SSIS, SSRS, and SQL for securities trading applications.</li>
          <li>Supported large SQL processes and developed data access pages using third-party software.</li>
        </ul>

        <h3>Web Application Developer - Bank of America, Charlotte, NC (Jul 2017 - Dec 2018)</h3>
        <ul>
          <li>Added functionality and maintained web applications for the legal department using C# .NET, SQL, and ASP.NET.</li>
          <li>Constructed websites and frameworks to facilitate application transitions to new designs.</li>
        </ul>

        <h3>Computer Programmer - C.A Short, Shelby, NC (Jan 2016 - Jun 2017)</h3>
        <ul>
          <li>Maintained enterprise applications and websites using VB.Net, C#, WinForms, and SQL.</li>
          <li>Optimized enterprise code with multithreading and query improvements.</li>
        </ul>

        <h3>Programmer - VectorVest Inc, Cornelius, NC (Oct 2013 - Jan 2015)</h3>
        <ul>
          <li>Developed client and employee software for real-time stock market data using C#, VB.NET, and SQL Server.</li>
          <li>Built multi-threaded solutions for performance issues in client applications.</li>
        </ul>

        <h3>Software Engineer - Wells Fargo Securities, Charlotte, NC (Jan 2013 - Oct 2013)</h3>
        <ul>
          <li>Worked on a multi-threaded trading application using C#, WinForms, and SQL.</li>
          <li>Collaborated with cross-functional teams to clarify project requirements and implemented logging systems for monitoring applications.</li>
        </ul>

        <h3>Build and Release Engineer - Wells Fargo, Charlotte, NC (Jun 2011 - Jun 2012)</h3>
        <ul>
          <li>Coordinated build and release processes for over 800 applications using automated tools.</li>
          <li>Provided analysis for broken builds across various programming languages.</li>
        </ul>
      </section>

      <section>
        <h2>Education</h2>
        <ul>
          <li><strong>Professional Science Masters:</strong> Data Science and Business Analytics, University Of North Carolina, Charlotte, NC (2018)</li>
          <li><strong>Bachelor of Science:</strong> Computer Engineering, University Of South Carolina, Columbia, SC (2011)</li>
        </ul>
      </section>

      <section>
        <h2>Skills</h2>
        <ul>
          <li><strong>Programming:</strong> C#, SQL, ASP.NET, SQL, NOSQL, Python 3, JSON, JavaScript, R, VB, HTML, CSS</li>
          <li><strong>Applications:</strong> Visual Studio, VS Code, Azure, SSMS, Power BI, SAS EG, Tableau, R Studio, Access, Excel</li>
          <li><strong>Tools & Platforms:</strong> .NET Core, Azure DevOps, ReactJS, Knockout, Bootstrap, Angular, Jupyter
          Notebook, MVC, GitHub, Git, Docker, Kubernetes, WPF, Forms </li>
        </ul>
      </section>
    </div>
  );
};

export default Resume;
