import React from "react";

const Resume = () => {
  return (
    <div style={{ padding: '20px', fontFamily: 'Arial, sans-serif', color: '#bfbfbf', transition: "margin-left 0.3s ease", margin: "50px" }}>
      <h1 style={{ textAlign: 'center', color: '#2873bd' }}>Thomas McNair Bledsoe</h1>
      <h3 style={{ textAlign: 'center', color: '#2873bd' }}>Software Developer</h3>
      <p style={{ textAlign: 'center' }}>Greenville, SC | tmcnairbledsoe@gmail.com | 864-804-9796</p>
      
      <section>
        <h2 style={{ color: '#2873bd' }}>Summary</h2>
        <p>
          Seasoned software developer with expertise in C#, .NET, SQL, Azure, Python, React, APIs, and more. Experienced in developing, maintaining, 
          and designing applications across various industries. Proven ability to innovate, automate workflows, and enhance system efficiency.
        </p>
      </section>

      <section>
        <h2 style={{ color: '#2873bd' }}>Skills</h2>
        <ul>
          <li><strong>Programming Languages:</strong> C#, SQL, ASP.NET, SQL, NOSQL, Python 3, JSON, JavaScript, R, VB, HTML, CSS</li>
          <li><strong>Applications:</strong> Visual Studio, VS Code, Azure, SSMS, Power BI, SAS EG, Tableau, R Studio, Access, Excel</li>
          <li><strong>Tools, Platforms, & Libraries:</strong> .NET Core 8, Azure DevOps, ReactJS, Knockout, Bootstrap, Angular, Jupyter Notebook, 
          MVC, GitHub, Git, Docker, Kubernetes, WPF, Forms</li>
        </ul>
      </section>

      <section>
        <h2 style={{ color: '#2873bd' }}>Professional Experience</h2>

        <h3>Software Developer - Metromont, Greenville, SC (08/2023 - 08/2024)</h3>
        <ul>
          <li>Developed custom applications using Autodesk Platform services and Azure tools.</li>
          <li>Automated project lifecycle tasks with Azure Functions and Logic Apps, reducing manual work.</li>
          <li>Maintained Revit Addins using C# and implemented SSO with Active Directory and Entra ID.</li>
        </ul>

        <h3>Senior Software Developer - Grace Hill, Greenville, SC (04/2021 - 08/2023)</h3>
        <ul>
          <li>Led a small team to enhance a web portal for real estate management, integrating complex user and tenant management features.</li>
          <li>Developed new React micro front-end components and a survey comparison tool connecting to Qualtrics.</li>
          <li>Maintained and improved internal tools, ensuring high reliability and performance. Optimized dynamic stored procedures.</li>
        </ul>

        <h3>Web Application Developer - RealPage Contact Center, Greenville, SC (05/2020 - 03/2021)</h3>
        <ul>
          <li>Supported call center operations with web applications, including call automation and reporting tools.</li>
          <li>Refactored legacy ASP.NET code into modern React and Node applications.</li>
          <li>Developed Core RESTful APIs to decouple direct SQL calls in legacy applications.</li>
        </ul>

        <h3>Software Developer - Cass Information Systems, Greenville, SC (12/2019 - 03/2020)</h3>
        <ul>
          <li>Maintained and developed enterprise and customer-facing sites using ASP.NET and Angular 4.</li>
          <li>Improved customer experience by implementing SSO and enhancing site functionalities.</li>
        </ul>

        <h3>Software Developer - Barings, Charlotte, NC (12/2018 - 05/2019)</h3>
        <ul>
          <li>Collaborated with a fixed income trading team to develop applications using SSIS, SSRS, and C#.</li>
          <li>Provided on-call support for large SQL processes and developed data access pages.</li>
        </ul>

        <h3>Web Application Developer - Bank of America, Charlotte, NC (07/2017 - 12/2018)</h3>
        <ul>
          <li>Maintained and enhanced web applications for the legal department using C#, ASP.NET, and SQL.</li>
          <li>Designed and built new websites and APIs to modernize legacy systems.</li>
        </ul>

        <h3>Computer Programmer - C.A. Short, Shelby, NC (01/2016 - 06/2017)</h3>
        <ul>
          <li>Maintained enterprise code and customer-facing websites using VB.NET, C#, and SQL.</li>
          <li>Improved process efficiency through multithreading and query optimization.</li>
        </ul>

        <h3>Programmer - VectorVest Inc, Cornelius, NC (10/2013 - 01/2015)</h3>
        <ul>
          <li>Developed services and clients for real-time streaming stock market data using C# and SQL.</li>
          <li>Created multi-threaded solutions to optimize client performance.</li>
        </ul>

        <h3>Software Engineer - Wells Fargo Securities, Charlotte, NC (01/2013 - 10/2013)</h3>
        <ul>
          <li>Supported and developed a multi-threaded trading application for fixed income trading.</li>
          <li>Collaborated with QA and trading floor users to define and prioritize project requirements.</li>
        </ul>

        <h3>Build and Release Engineer - Wells Fargo, Charlotte, NC (06/2011 - 06/2012)</h3>
        <ul>
          <li>Coordinated with application teams to optimize build and release processes using automated tools.</li>
          <li>Supported over 800 applications, providing analysis and troubleshooting for build issues.</li>
        </ul>
      </section>

      <section>
        <h2 style={{ color: '#2873bd' }}>Education</h2>
        <ul>
          <li><strong>Professional Science Masters:</strong> Data Science and Business Analytics, University Of North Carolina, Charlotte, NC (December 2018)</li>
          <li><strong>Bachelor of Science:</strong> Computer Engineering, University Of South Carolina, SC (May 2011)</li>
        </ul>
      </section>
    </div>
  );
};

export default Resume;
