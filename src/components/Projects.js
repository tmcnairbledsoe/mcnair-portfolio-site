import React from "react";

const Projects = () => {
  return (
    <div style={{ padding: "20px", color: "#bfbfbf", transition: "margin-left 0.3s ease", margin: "50px" }}>
      <h2 style={{ textAlign: "center" }}>Projects</h2>
      <p style={{ textAlign: "left" }}>
        This is the projects page.
      </p>
      <p style={{ textAlign: "left" }}>
        Anything I make is usually open for anyone to view on my GitHub unless it has private info in it, which can now easily
        be handled by secrets. I'll update all of that sometime so i can show bots I made in python. Websites such as this one and any others below is open on my <a href="https://github.com/tmcnairbledsoe">GitHub</a>.
      </p>
      <h2 style={{ textAlign: "center" }}>Websites</h2>
      <p style={{ textAlign: "left" }}>
        I'll have a lot more coming into here once I get time to set up and host some stuff I made. In the mean time check out my wife's site I made in React. <a href="https://clt-art.com/">clt-art.com/</a>
      </p>
    </div>
  );
};

export default Projects;
