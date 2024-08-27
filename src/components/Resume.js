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
          Seasoned software developer with expertise in a broad range of technologies, including C#, .NET, SQL, Azure, Python, React, and more. 
          Experienced in developing, maintaining, and designing applications across various industries, with a focus on efficiency, automation, and innovation.
        </p>
      </section>

      <section>
        <h2 style={{ color: '#2873bd' }}>Skills</h2>
        <ul>
          <li><strong>Programming Languages:</strong> C#, .NET, SQL, Python, React, Angular, JavaScript, Node, R, WPF, VB, ASP.NET</li>
          <li><strong>Applications:</strong> Visual Studio, Azure, Power BI, SAS EG, Tableau</li>
        </ul>
      </section>

      <section>
        <h2 style={{ color: '#2873bd' }}>Professional Experience</h2>

        <h3>Software Developer - Metromont, Greenville, SC (08/2023 - 08/2024)</h3>
        <ul>
          <li>Developed custom applications using Autodesk Platform services and Azure tools.</li>
          <li>Automated project lifecycle tasks using Azure Functions and Logic Apps.</li>
          <li>Implemented SSO using Active Directory and Entra ID.</li>
        </ul>

        <h3>Senior Software Developer - Grace Hill, Greenville, SC (04/2021 - 08/2023)</h3>
        <ul>
          <li>Maintained and enhanced a web portal for real estate management clients.</li>
          <li>Led a team to improve user and tenant management features.</li>
          <li>Developed new React micro front-end components.</li>
        </ul>

        <h3>Web Application Developer - RealPage Contact Center, Greenville, SC (05/2020 - 03/2021)</h3>
        <ul>
          <li>Developed and supported internal and external applications for Call Center operations.</li>
          <li>Refactored legacy code into modern React and Node applications.</li>
        </ul>

        <h3>Software Developer - Various Roles</h3>
        <ul>
          <li>Developed and maintained web applications, trading platforms, and customer-facing sites at companies like Cass Information Systems, Barings, Bank of America, and Wells Fargo.</li>
          <li>Experienced in Agile methodology, DevOps, and on-call support for critical applications.</li>
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
