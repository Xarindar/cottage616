import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import test from 'node:test';

const source = readFileSync(new URL('../scripts/integrations/showrunner/content.js', import.meta.url), 'utf8');
const take = (name, next) => source.slice(source.indexOf(`  function ${name}(`), source.indexOf(`  function ${next}(`));
const node = () => ({ dataset: {}, textContent: '', innerHTML: '', dispatchEvent() {} });
test('events, gallery, reviews and vendor renderers identify their editable text fields', () => {
  const image=node(), heading=node(), intro=node(), cards=node(), gallery=node(), reviewHeading=node(), reviewIntro=node(), reviews=node();
  const elements={ '#events.event-showcase': {querySelector: selector=>selector.includes('feature')?image:cards}, '#events .event-showcase__header h2':heading, '#events .event-showcase__intro':intro, '.venue-strip [data-carousel-track]':cards, '.venue-strip__copy':gallery, '[data-showrunner-testimonials]':node(), '[data-content-testimonial-list]':reviews, '[data-content-testimonial-heading]':reviewHeading, '[data-content-testimonial-intro]':reviewIntro };
  gallery.querySelector=()=>node();
  const functions=[take('applyEventsPanel','applyVenueGallery'),take('applyVenueGallery','applyVendorDirectory'),take('hasGuestOffer','vendorGroups'),take('vendorCard','contactLink'),take('applyTestimonials','testimonialCard'),take('testimonialCard','setText'),take('setText','escapeHtml')].join('\n');
  const api=runInNewContext(functions+'\n({applyEventsPanel,applyVenueGallery,applyTestimonials,vendorCard})',{document:{querySelector: selector=>elements[selector]},Event:class{},escapeHtml:String,escapeAttribute:String,contactLink:()=>'',displayPhone:String,displayEmail:String});
  api.applyEventsPanel({heading:'Events',copy:'Intro',items:[{name:'Birthday',description:'Celebrate'}]});
  assert.equal(heading.dataset.srField,'heading'); assert.equal(intro.dataset.srField,'copy');
  assert.equal(image.dataset.srField,'imageUrl'); assert.match(cards.innerHTML,/data-sr-field="items.0.title"/); assert.match(cards.innerHTML,/data-sr-field="items.0.description"/);
  api.applyVenueGallery({heading:'Venue',images:[]}); assert.equal(gallery.dataset.srField,'heading');
  api.applyTestimonials({heading:'Reviews',intro:'Guests',items:[{authorName:'Guest',quote:'Lovely'}]});
  assert.equal(reviewHeading.dataset.srField,'heading'); assert.equal(reviewIntro.dataset.srField,'copy');
  assert.match(reviews.innerHTML,/data-sr-field="items.0.author"/); assert.match(reviews.innerHTML,/data-sr-field="items.0.quote"/);
  const vendor=api.vendorCard({name:'Florist',category:'Flowers',description:'Local',offer:'Discount'},2);
  for(const field of ['name','category','description','offer']) assert(vendor.includes(`data-sr-field="items.2.${field}"`));
});
