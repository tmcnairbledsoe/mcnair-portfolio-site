import React from "react";
import "./Location.css";


export default function Location( {user} ){

  function displayReheasal(){
    if(user.isRehearsal){
      return(
          <div><a href="https://goo.gl/maps/9N8goakAaMANqEst5" target="_blank" rel="noreferrer">Wedding Rehearsal: Larkin's Upstairs</a></div>
      );
    }
  }

  return(
      <div className="location section" id="location">
        <h2>Locations</h2>
        <hr />
        <p>
          The ceremony will be held at Fourth Presbyterian Church near downtown Greenville. The reception will be held at Zen, located downtown.
        </p>
        <p>
          Original event locations are linked below. This wedding took place in April 2022.
        </p>

        <div id="directions">
          <div className="transportList">
            <h2>
              <i className="fas fa-car" />
              Event Locations
            </h2>
            <span className="detailedDirections">
                {displayReheasal()}
                <div><a href="https://goo.gl/maps/qTU2LPLx8UfUKipu9" target="_blank" rel="noreferrer">Wedding Ceremony: Fourth Presbyterian</a></div>
                <div><a href="https://goo.gl/maps/yp5W67Frvqf5DH2V9" target="_blank" rel="noreferrer">Wedding Reception: Zen</a></div>
            </span>
          </div>
          <div className="transportList">
            <h2>
              <i className="fas fa-bed" />
              Hotels
            </h2>
            <span className="detailedDirections">
              <h4>Original wedding hotel links (2022)</h4>
              <div><a href="https://www.hilton.com/en/book/reservation/deeplink/?ctyhocn=GSPDTHX&groupCode=CHHBTW&arrivaldate=2022-04-08&departuredate=2022-04-10&cid=OM,WW,HILTONLINK,EN,DirectLink&fromId=HILTONLINKDIRECT" target="_blank" rel="noreferrer">Hampton Inn & Suites</a> </div>
              <div><a href="https://www.hilton.com/en/book/reservation/deeplink/?ctyhocn=GSPGDES&groupCode=CESBTW&arrivaldate=2022-04-08&departuredate=2022-04-10&cid=OM,WW,HILTONLINK,EN,DirectLink&fromId=HILTONLINKDIRECT" target="_blank" rel="noreferrer">Embassy Suites by Hilton</a> </div>
              <div><a href="https://www.hilton.com/en/book/reservation/deeplink/?ctyhocn=GSPSOHW&groupCode=CHWTOW&arrivaldate=2022-04-08&departuredate=2022-04-10&cid=OM,WW,HILTONLINK,EN,DirectLink&fromId=HILTONLINKDIRECT" target="_blank" rel="noreferrer">Homewood Suites by Hilton </a> </div>
            </span>
          </div>
          <div className="transportList">
            <h2>
              <i className="fa fa-map-marker " />
              Legend
            </h2>
            <span className="detailedDirections">
              <img src="/weddingsite/images/Mapicons/blue-dot.png" alt ="blue-dot"/> Event locations
              <br />
              <img src="/weddingsite/images/Mapicons/green-dot.png" alt ="green-dot"/> Greenville spots
              <br />
              <img src="/weddingsite/images/Mapicons/yellow-dot.png" alt ="yellow-dot"/> Hotels
              <br />
            </span>
          </div>
        </div>
      </div>
  );
}
