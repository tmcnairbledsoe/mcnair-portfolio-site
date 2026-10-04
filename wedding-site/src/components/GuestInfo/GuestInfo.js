import React from 'react';
export default function GuestInfo({user}) {
  const map = user.isRehearsal ? 'Downtown Greenville Map for Rehearsal Dinner.jpg' : 'Downtown Greenville Map for Wedding.jpg';
  return <section className="section" id="guestInfo"><h2>Guest Info</h2><p>The original event schedule for your selected role.</p>
    <div className="event-schedule">
      {user.isRehearsal && <section aria-label="Rehearsal schedule"><h3>Friday · April 8, 2022</h3><ul><li>5:00 PM: Wedding rehearsal at Fourth Presbyterian</li><li>6:30 PM: Rehearsal dinner at Larkin’s Upstairs</li></ul></section>}
      <section aria-label="Wedding schedule"><h3>Saturday · April 9, 2022</h3><ul>
        {user.isWeddingParty && <><li>9:00 AM: Bridesmaids meet in the church basement with dresses. Breakfast provided.</li><li>10:30 AM: Groomsmen meet at Top Golf</li><li>1:00 PM: Bridesmaids’ light lunch</li><li>2:30 PM: Wedding party pictures at the church</li></>}
        <li>4:00 PM: Wedding ceremony at Fourth Presbyterian</li><li>5:30 PM: Wedding reception at Zen</li></ul></section>
      {user.isBrunch && <section aria-label="Brunch schedule"><h3>Sunday · April 10, 2022</h3><ul><li>10:00 AM – 12:00 PM: Brunch at the Lazy Goat</li></ul></section>}
    </div>
    <h3 className="map-heading">Printable Event Map</h3><a className="printable-map" href={'/weddingsite/images/' + map} target="_blank" rel="noreferrer"><img src={'/weddingsite/images/' + map} alt={user.isRehearsal ? 'Wedding and rehearsal event map' : 'Wedding event map'} /></a>
  </section>;
}
