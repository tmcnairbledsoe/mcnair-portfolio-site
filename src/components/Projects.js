import React from "react";

const Projects = () => {
  return (
    <div style={{ padding: "20px", color: "#bfbfbf", transition: "margin-left 0.3s ease", marginRight: "50px" }}>
      <h2 style={{ textAlign: "center" }}>Projects</h2>
      <p style={{ textAlign: "left" }}>
        This is the projects page.
      </p>
      <p style={{ textAlign: "left" }}>
        Anything I make is usually open for anyone to view on my GitHub unless it has private info in it, which can now easily
        be handled by secrets. I'll update all of that sometime so i can show bots I made in python and websites. Everything else 
        is open on my <a href="https://github.com/tmcnairbledsoe">GitHub</a>.
      </p>
      <h2 style={{ textAlign: "center" }}>Websites</h2>
      <p style={{ textAlign: "left" }}>
        I'll have a lot more coming into here once I get time to set up and host some stuff I made. In the mean time check out my 
        wife's site I made in React. <a href="https://clt-art.com/">clt-art.com/</a>
      </p>
      <p style={{ textAlign: "left" }}>
        The first thing I should talk about is this site. It's public on my github and is ued for CI/CD. The site is hosted on Azure
        for free as a static web app. It only took me about 3 hours to create the basic site and host it on Azure. Things have become
        easier and more intuitive than ever. I simply hosted the code from VS Code's GitHub addon to my personal repository. I was 
        then able to connect that repo to the azure static web app for CI/CD. Whenever I make a commit to master, the changes are
        automatically uploaded. Gone are the days of FTP and refreshing the site.
      </p>
      <p style={{ textAlign: "left" }}>
        ToDo:
        <br></br>
        - Secrets in GitHub or Azure for scripts and websites
        <br></br>
        - Wedding Site
        <br></br>
        - African conflicts R project
        <br></br>
        - Stock trader
        <br></br>
        - Stock backtrader
        <br></br>
        - Blog
        <br></br>
        - Signin using AD (personal)
        <br></br>
        - Calendar (personal)
        <br></br>
        - Journal (personal)
        <br></br>
        - Collaboration site (personal)
      </p>
    </div>
  );
};

export default Projects;
