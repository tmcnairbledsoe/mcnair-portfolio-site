import React from "react";
import "./AboutUs.css";
import ImageGallery from 'react-image-gallery';
import "react-image-gallery/styles/css/image-gallery.css";

export default function AboutUs(){

    const images = [
        {
          original: '/weddingsite/images/1.jpg',
          thumbnail: '/weddingsite/images/1.jpg',
          originalHeight: 850,
          originalWidth: 850,
        },
        {
          original: '/weddingsite/images/2.jpg',
          thumbnail: '/weddingsite/images/2.jpg',
          originalHeight: 850,
          originalWidth: 850,
        },
        {
          original: '/weddingsite/images/3.jpg',
          thumbnail: '/weddingsite/images/3.jpg',
          originalHeight: 850,
          originalWidth: 850,
        },
        {
          original: '/weddingsite/images/4.jpg',
          thumbnail: '/weddingsite/images/4.jpg',
          originalHeight: 850,
          originalWidth: 850,
        },
        {
          original: '/weddingsite/images/5.jpg',
          thumbnail: '/weddingsite/images/5.jpg',
          originalHeight: 850,
          originalWidth: 850,
        },
        {
          original: '/weddingsite/images/6.jpg',
          thumbnail: '/weddingsite/images/6.jpg',
          originalHeight: 850,
          originalWidth: 850,
        },
        {
          original: '/weddingsite/images/7.jpg',
          thumbnail: '/weddingsite/images/7.jpg',
          originalHeight: 850,
          originalWidth: 850,
        },
        {
          original: '/weddingsite/images/8.jpg',
          thumbnail: '/weddingsite/images/8.jpg',
          originalHeight: 850,
          originalWidth: 850,
        },
        {
          original: '/weddingsite/images/9.jpg',
          thumbnail: '/weddingsite/images/9.jpg',
          originalHeight: 850,
          originalWidth: 850,
        },
        {
          original: '/weddingsite/images/10.jpg',
          thumbnail: '/weddingsite/images/10.jpg',
          originalHeight: 850,
          originalWidth: 850,
        },
        {
          original: '/weddingsite/images/11.jpg',
          thumbnail: '/weddingsite/images/11.jpg',
          originalHeight: 850,
          originalWidth: 850,
        },
        {
          original: '/weddingsite/images/12.jpg',
          thumbnail: '/weddingsite/images/12.jpg',
          originalHeight: 850,
          originalWidth: 850,
        },
        {
          original: '/weddingsite/images/13.jpg',
          thumbnail: '/weddingsite/images/13.jpg',
          originalHeight: 850,
          originalWidth: 850,
        },
        {
          original: '/weddingsite/images/14.jpg',
          thumbnail: '/weddingsite/images/14.jpg',
          originalHeight: 850,
          originalWidth: 850,
        },
        {
          original: '/weddingsite/images/15.jpg',
          thumbnail: '/weddingsite/images/15.jpg',
          originalHeight: 850,
          originalWidth: 850,
        },
        {
          original: '/weddingsite/images/16.jpg',
          thumbnail: '/weddingsite/images/16.jpg',
          originalHeight: 850,
          originalWidth: 850,
        },
        {
          original: '/weddingsite/images/17.jpg',
          thumbnail: '/weddingsite/images/17.jpg',
          originalHeight: 850,
          originalWidth: 850,
        },
        {
          original: '/weddingsite/images/18.jpg',
          thumbnail: '/weddingsite/images/18.jpg',
          originalHeight: 850,
          originalWidth: 850,
        },
        {
          original: '/weddingsite/images/19.jpg',
          thumbnail: '/weddingsite/images/19.jpg',
          originalHeight: 850,
          originalWidth: 850,
        },
        {
          original: '/weddingsite/images/20.jpg',
          thumbnail: '/weddingsite/images/20.jpg',
          originalHeight: 850,
          originalWidth: 850,
        },
        {
          original: '/weddingsite/images/21.jpg',
          thumbnail: '/weddingsite/images/21.jpg',
          originalHeight: 850,
          originalWidth: 850,
        },
        {
          original: '/weddingsite/images/22.jpg',
          thumbnail: '/weddingsite/images/22.jpg',
          originalHeight: 850,
          originalWidth: 850,
        },
        {
          original: '/weddingsite/images/23.jpg',
          thumbnail: '/weddingsite/images/23.jpg',
          originalHeight: 850,
          originalWidth: 850,
        },
        {
          original: '/weddingsite/images/24.jpg',
          thumbnail: '/weddingsite/images/24.jpg',
          originalHeight: 850,
          originalWidth: 850,
        },
        {
          original: '/weddingsite/images/25.jpg',
          thumbnail: '/weddingsite/images/25.jpg',
          originalHeight: 850,
          originalWidth: 850,
        },
        {
          original: '/weddingsite/images/26.jpg',
          thumbnail: '/weddingsite/images/26.jpg',
          originalHeight: 850,
          originalWidth: 850,
        },
        {
          original: '/weddingsite/images/27.jpg',
          thumbnail: '/weddingsite/images/27.jpg',
          originalHeight: 850,
          originalWidth: 850,
        },
        {
          original: '/weddingsite/images/28.jpg',
          thumbnail: '/weddingsite/images/28.jpg',
          originalHeight: 850,
          originalWidth: 850,
        },
        {
          original: '/weddingsite/images/29.jpg',
          thumbnail: '/weddingsite/images/29.jpg',
          originalHeight: 850,
          originalWidth: 850,
        },
      ];

      const friendimages = [
          {
            original: '/weddingsite/images/f1.jpg',
            thumbnail: '/weddingsite/images/f1.jpg',
            originalHeight: 850,
            originalWidth: 850,
          },
          {
            original: '/weddingsite/images/f2.jpg',
            thumbnail: '/weddingsite/images/f2.jpg',
            originalHeight: 850,
            originalWidth: 850,
          },
          {
            original: '/weddingsite/images/f3.jpg',
            thumbnail: '/weddingsite/images/f3.jpg',
            originalHeight: 850,
            originalWidth: 850,
          },
          {
            original: '/weddingsite/images/f4.jpg',
            thumbnail: '/weddingsite/images/f4.jpg',
            originalHeight: 850,
            originalWidth: 850,
          },
          {
            original: '/weddingsite/images/f5.jpg',
            thumbnail: '/weddingsite/images/f5.jpg',
            originalHeight: 850,
            originalWidth: 850,
          },
          {
            original: '/weddingsite/images/f6.jpg',
            thumbnail: '/weddingsite/images/f6.jpg',
            originalHeight: 850,
            originalWidth: 850,
          },
          {
            original: '/weddingsite/images/f7.jpg',
            thumbnail: '/weddingsite/images/f7.jpg',
            originalHeight: 850,
            originalWidth: 850,
          },
          {
            original: '/weddingsite/images/f8.jpg',
            thumbnail: '/weddingsite/images/f8.jpg',
            originalHeight: 850,
            originalWidth: 850,
          },
          {
            original: '/weddingsite/images/f9.jpg',
            thumbnail: '/weddingsite/images/f9.jpg',
            originalHeight: 850,
            originalWidth: 850,
          },
          {
            original: '/weddingsite/images/f10.jpg',
            thumbnail: '/weddingsite/images/f10.jpg',
            originalHeight: 850,
            originalWidth: 850,
          },
          {
            original: '/weddingsite/images/f11.jpg',
            thumbnail: '/weddingsite/images/f11.jpg',
            originalHeight: 850,
            originalWidth: 850,
          },
          {
            original: '/weddingsite/images/f12.jpg',
            thumbnail: '/weddingsite/images/f12.jpg',
            originalHeight: 850,
            originalWidth: 850,
          },
          {
            original: '/weddingsite/images/f13.jpg',
            thumbnail: '/weddingsite/images/f13.jpg',
            originalHeight: 850,
            originalWidth: 850,
          },
          {
            original: '/weddingsite/images/f14.jpg',
            thumbnail: '/weddingsite/images/f14.jpg',
            originalHeight: 850,
            originalWidth: 850,
          },
        ];

    return(
        <div className="section" id="aboutUs">
            <h2>About Us</h2>
            <hr />
            <div id="info">
                <div id="bride">
                    <a href="/weddingsite/images/Charlotte.jpg" target="_blank" rel="noreferrer" className="image">
                        <img
                        title="Charlotte"
                        alt="Charlotte"
                        className="bridePhoto"
                        src="/weddingsite/images/Charlotte.jpg"
                        />
                    </a>
                    <p className="moreinfo">
                        Time flies with Charlotte. It has only been a year and a half since I met her but it was very early on that I knew
                        I wanted to spend as much time with her as was gifted to me. It seems like it has been a long time since we met and much has happened,
                        yet time seems short paradoxically. Charlotte's qualities are outstanding. Her soul shine's bright and she does not hide
                        her light. She is refined, beautiful and intelligent. She has a curiosity that continues and a certain discipline that I greatly respect.
                        When we first met it amazed me how well we were able to get along. As time went on, our bond grew.
                        We travel together, explore art in Greenville, and do our best to enjoy the pleasures of life where we can. It is easy to find
                        something new to explore with her. There are many things Charlotte has learned in her life and she continues to share those things
                        with me and refine them for herself. She paints in her spare time and I get to enjoy her practice of piano at home. She also is an
                        avid swimmer and I enjoy getting in my kayak alongside her in the open water. She has also taught me how to sail. In our time together
                        I have learned Charlotte is a wonderfully kind and patient person with positivity and love for life and God. She does not let herself become
                        frustrated at life and understands that if life becomes hard there is a different perspective to help her.
                        She loves her friends and family and puts an effort to show them her love. Her family is an amazing group of people and
                        have passed on many good values to Charlotte. They have also been very loving and welcoming to me. I have much to learn and experience with them all.
                    </p>
                </div>
                <div id="brideandgroom">
                    <a href="/weddingsite/images/McNairAndChar.jpg" target="_blank" rel="noreferrer">
                        <img
                        alt="Charlotte and McNair"
                        title="Charlotte and McNair"
                        className="brideAndGroomPhoto"
                        src="/weddingsite/images/McNairAndChar.jpg"
                        />
                    </a>
                    <p className="moreinfo">
                        We met at Gather Greenville, an outdoor dining shipping container restaurant village in the summer of 2020.
                        Despite Covid we quickly formed a close bond, during long conversations and hikes in the western SC mountains.
                        We realized that we have so many things in common from a shared love of cooking, music, art, faith, the outdoors, and traveling.
                        We sometimes have music date nights where we play the piano, guitar & sing together.  We learned this song together called
                        Perfect Day by Lou Reed that later became McNair’s inspiration for proposing. We took the day off & went to the MC Escher
                        exhibit at the Columbia art museum then came back & had a delicious picnic in the park with sangria, flowers and chocolate.
                        We got engaged on May 21, 2021 on a beautiful spring afternoon and enjoyed the breeze in a hammock between the trees overlooking
                        the Reedy River.  We have grown closer together getting to have more special times with family
                        and friends. It’s exciting to be diving into this next big phase of our lives together.  We want to welcome all of our close friends
                        and family to celebrate with us at our upcoming wedding festivities.  Thank you for all of your love, support and good times over
                        the years!  Looking forward to seeing you on April 9th!
                    </p>
                </div>
                <div id="groom">
                    <a href="/weddingsite/images/McNair.jpg" target="_blank" rel="noreferrer">
                        <img
                        title="McNair"
                        alt="McNair"
                        className="groomPhoto"
                        src="/weddingsite/images/McNair.jpg"
                        />
                    </a>
                    <p className="moreinfo">
                        Some of the things that amaze me about McNair is his ability to cook, often making delicious plant-based meals
                        after I come home from a long day at work & the gym.  My family always had a garden growing up so I was excited
                        to find out that McNair’s taken an interest in gardening and growing a green thumb.  He has a very laid-back,
                        kind & interesting demeanor & I always enjoy our conversations together.  From the start of our relationship he
                        has always been planning trips outdoors: hiking, skiing, and kayaking beside me while I open water swim at the
                        lake or beach.  His adventurous spirit gets me outside more often and I love these times we have together!  He’s
                        been very supportive of my career as an architect and even has thoughtful comments about my artwork.  Even though his cat Libby
                        doesn’t like me, I guess she’s worth putting up with if it means joining in on his random fun ideas like making
                        our own kombucha or learning Italian and how to cook Italian food.  We have also been exploring the Christian faith
                        more and have found a church together, 4th Presbyterian of Greenville that is strengthening our faith and values.
                        We look forward to being more involved in this community and giving back as we grow roots here.  I knew right away
                        from meeting the Bledsoe family that they are hard-working, loving, smart and welcoming people.  They made me feel
                        at home right away and I’ve had so much fun already with them playing games with his nieces and nephew and couldn’t
                        be more thrilled to be joining their family.  My family has been a strong supportive rock over the years and it’s
                        exciting to join both sides together as we move forward in this journey of life.
                    </p>
                </div>
            </div>
            <div id="carousel">
                <ImageGallery items={images} showThumbnails={false} />
            </div>
            <br></br>

            <h2>Bridesmaids</h2>
            <hr />
            <p id="bridemaidinfo">
                During high school when Jenni moved within a five minute walk to our house, we quickly became friends.  Whether we were doing art and cooking projects,
                going to high school swim meets, or singing at church, we were always having fun together.  We both went to UNC Chapel Hill for college and became closer
                friends exploring the campus, constantly laughing and meeting new friends.  Jenni has always stayed in touch and been a true friend through the good and
                difficult times and I’m happy that she’ll be my Matron of Honor.  It was through Jenni that I met and became close friends at Carolina with Brenda, Jessie and
                Megan.  Whether we were throwing dinner parties, taking art classes, going on trips together, or hopping bonfires on Franklin St after winning basketball games,
                we were always having a blast.  During senior year at UNC my roommate Robin became another great friend over the years, going on adventures together running,
                hiking and having hours long phone conversations on the road.  When I moved to Wilmington, one of the first people I met and quickly because friends with was
                Laura who showed me all the fun places in downtown.  We have so many great memories together going to karaoke, dancing and at the beach.  I am so lucky to have
                all these friends and am constantly amazed at how supportive, accomplished, and fun loving they are, but mostly how genuine and caring they are to each other and
                to their families.  Over the years, it has brought me so much joy to see my friends meet their professional goals, get married and start families.  Along that note,
                another one of my best friends who has always been there for me through life’s journey, whether going on family adventures over the years or having long intellectual
                phone conversations where we share everything about life with each other, is my brother William.  When my brother met Tina on a hiking trip and they fell in love,
                I was so happy for him and am now thrilled that they have their daughter Pearl, my sweet little niece. Naturally my sister-in-law Tina is a bridesmaid and I’m also
                excited to have McNair’s sister Mary Katherine, my future sister-in-law in the wedding.  She is a wonderfully kind person with a beautiful family and has the biggest
                heart.  I look forward to sharing many more great memories with them in the future.
            </p>
            <div id="carousel">
                <ImageGallery items={friendimages} showThumbnails={false} />
            </div>
        </div>
    );
}
