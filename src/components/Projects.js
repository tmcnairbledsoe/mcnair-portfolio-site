import React from "react";
import './Projects.css';

const Projects = () => {
  return (
    <div className="container">
      <h2>Projects</h2>
      <p>
        Anything I make is usually open for anyone to view on my GitHub. Private hubs i am currently updating to use
        secrets to store private information before I make them public. 
        <a href="https://github.com/tmcnairbledsoe" target="_blank" rel="noopener noreferrer">GitHub</a>.
      </p>
      <h2>Websites</h2>
      <p>
        Check out my wife's site I made in React featuring her art work: <a href="https://clt-art.com/" target="_blank" rel="noopener noreferrer">clt-art.com/</a>
      </p>
      <p>
        My wedding website was one that I made for our guests to give and recieve information such as RSVP, song requests during reception, 
        and information on Greenville: <a href="/weddingsite" target="_blank" rel="noopener noreferrer">Wedding Page</a>
        The githup repo is <a href="https://github.com/tmcnairbledsoe/clttmbwedding" target="_blank" rel="noopener noreferrer">clttmbwedding</a>.
        It uses firebase as a backend which is free and pretty handy. It also uses Google API to interact with its maps. Its a create react app.
      </p>
      <h2>Data Science</h2>
      <p>
         I am updating my old data science projects and scripts to be deployed and active. One example that is fun is a chess
         playing model that uses neural nets to make moves based on my past games. Essentially you are playing against me. 
        Once I get the ui made and handle the mid game training I'll host it here. The github is: 
         <a href="https://github.com/tmcnairbledsoe/chessModels" target="_blank" rel="noopener noreferrer">Chess Model Repo.</a>
      </p>
      <h2>Revit Add-in</h2>
      <p>
        I am working on a Revit Addin pattern manager. It previews all fill patterns. Metric, Empirical, Model, Drafting, etc.
        It draws out the pattern for a viewer So it can actually be seen. You can create a pattern in drafting view and then 
        save it as a pattern in the format you need it to be in, model, in inches, etc. It can save, import, export, etc:
        <a href="https://github.com/tmcnairbledsoe/McNairAddin" target="_blank" rel="noopener noreferrer">McNair's Add-in</a>
      </p>
      
      <h2>AI</h2>
      <p>
        It is huge and it is changing the world. But it's even bigger than I thought it would be. I was fascinated with the possibility
        of making predictions and decisions by machine learning techniques. I have many scripts in GitHub of basic models and techniques
        implemented in python on my github. Then after I got a masters in data science, Chat GPT became famous and was talked about by
        everyone I knew. For good reason. It's LLMs powered by neural networks, which were already mind blowingly powerful at making paccurate 
        predictions, are now the backbone of how we develop applications. I spend my spare time learning about, creating, and tinkering with
        AI models. They are the backbone of development now and are only becoming mroe powerful by the day. Now all of the apps and companies
        wee use daily to live implement tools that allow AI to interact with them and perform tasks that were previously difficult
        to automate. Neural nets can now make decisions for us and choose tools we program for it so that it can actually perform actions 
        for us while we live our lives. I will be posting my progress creating and learning about AI here to share how it can make our lives 
        much more automated and data driven. My goal is to use AI to make my life more data driven, supported by the facts and research of the 
        world using the abundance of data available to all of us, and confidently supported by automation. This is something we should all embrace 
        and learn to harness. It's too powerful not too. The edge is too great and no one can compete against someone who uses this technology 
        properly.
      </p>
    </div>
  );
};

export default Projects;
