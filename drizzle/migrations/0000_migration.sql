CREATE TABLE public.reps (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL UNIQUE,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE public.leads (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  company text NOT NULL,
  phone text NOT NULL,
  phone_normalized text NOT NULL UNIQUE,
  source text NOT NULL,
  last_contact_date date NOT NULL,
  rep_id uuid NOT NULL REFERENCES public.reps(id),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE public.messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id uuid NOT NULL REFERENCES public.leads(id) ON DELETE CASCADE,
  sender text NOT NULL CHECK (sender IN ('buyer','rep')),
  body text NOT NULL,
  sent_at timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX messages_lead_idx ON public.messages(lead_id, sent_at);
CREATE TABLE public.analyses (
  lead_id uuid PRIMARY KEY REFERENCES public.leads(id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','done','failed')),
  source text CHECK (source IN ('ai','sample','fallback')),
  classification text CHECK (classification IN ('Hot','Warm','Cold')),
  reason text,
  next_follow_up_date date,
  do_not_contact boolean NOT NULL DEFAULT false,
  urgent boolean NOT NULL DEFAULT false,
  suggested_message text,
  draft_message text,
  draft_edited boolean NOT NULL DEFAULT false,
  follow_up_status text NOT NULL DEFAULT 'pending' CHECK (follow_up_status IN ('pending','sent')),
  error text,
  analyzed_at timestamptz,
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE public.activities (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id uuid NOT NULL REFERENCES public.leads(id) ON DELETE CASCADE,
  type text NOT NULL,
  details text,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT ALL ON public.reps, public.leads, public.messages, public.analyses, public.activities TO service_role;
ALTER TABLE public.reps ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.leads ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.analyses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.activities ENABLE ROW LEVEL SECURITY;

INSERT INTO public.reps (name) VALUES ('Snehil Singh'),('Himansu Jha'),('Snehith Galla'),('Nayrhit Bhattacharya'),('Adithya Venkatesh');

INSERT INTO public.leads (name, company, phone, phone_normalized, source, last_contact_date, rep_id)
SELECT l.name, l.company, l.phone, regexp_replace(l.phone,'\D','','g'), l.source, current_date - l.days, r.id
FROM (VALUES
 ('Ramesh Iyer','FreshBake Foods','+91 98450 11201','Trade show',1,'Snehil Singh'),
 ('Anita Desai','Spice Route Exports','+91 98450 11202','Website enquiry',3,'Himansu Jha'),
 ('Mohammed Shaikh','Crystal Water Bottlers','+91 98450 11203','Referral',2,'Snehith Galla'),
 ('Kavita Rao','GreenLeaf Tea Co.','+91 98450 11204','IndiaMART',6,'Nayrhit Bhattacharya'),
 ('Suresh Patel','Patel Snacks Pvt Ltd','+91 98450 11205','Trade show',12,'Adithya Venkatesh'),
 ('Deepa Menon','Coastal Seafood Processors','+91 98450 11206','Website enquiry',4,'Snehil Singh'),
 ('Harish Gupta','Gupta Pharma Packs','+91 98450 11207','Cold call',20,'Himansu Jha'),
 ('Lakshmi Reddy','Annapurna Rice Mills','+91 98450 11208','Referral',2,'Snehith Galla'),
 ('Farhan Qureshi','Qureshi Dairy Products','+91 98450 11209','IndiaMART',8,'Nayrhit Bhattacharya'),
 ('Nisha Agarwal','Agarwal Cosmetics','+91 98450 11210','Website enquiry',15,'Adithya Venkatesh'),
 ('Gopal Krishnan','Krishna Pickles','+91 98450 11211','Trade show',5,'Snehil Singh'),
 ('Meera Joshi','Joshi Organics','+91 98450 11212','Facebook ad',9,'Himansu Jha'),
 ('Sanjay Bhatt','Bhatt Hardware Supplies','+91 98450 11213','Cold call',30,'Snehith Galla'),
 ('Pooja Sharma','Sharma Confectionery','+91 98450 11214','Website enquiry',3,'Nayrhit Bhattacharya'),
 ('Imran Khan','Khan Spices & Masala','+91 98450 11215','Referral',7,'Adithya Venkatesh'),
 ('Rekha Pillai','Kerala Coir Works','+91 98450 11216','IndiaMART',11,'Snehil Singh'),
 ('Ajay Malhotra','Malhotra Chemicals','+91 98450 11217','Trade show',18,'Himansu Jha'),
 ('Sunita Banerjee','Bengal Sweets House','+91 98450 11218','Facebook ad',4,'Snehith Galla'),
 ('Naveen Kumar','NK Frozen Foods','+91 98450 11219','Website enquiry',6,'Nayrhit Bhattacharya'),
 ('Divya Chawla','Chawla Pet Foods','+91 98450 11220','Referral',10,'Adithya Venkatesh'),
 ('Ravi Shetty','Shetty Cashew Exports','+91 98450 11221','Trade show',2,'Snehil Singh'),
 ('Alok Tiwari','Tiwari Agro Seeds','+91 98450 11222','Cold call',25,'Snehith Galla')
) AS l(name, company, phone, source, days, rep)
JOIN public.reps r ON r.name = l.rep;

INSERT INTO public.messages (lead_id, sender, body, sent_at)
SELECT ld.id, m.sender, m.body, (current_date - m.days)::timestamp + m.t::time
FROM (VALUES
 ('11201','buyer','Hi, we met at the PackTech expo. Need a quotation for an automatic pouch filling machine for 500g flour packs.',3,'10:05'),
 ('11201','rep','Thanks Ramesh ji! What output per minute are you targeting?',3,'10:20'),
 ('11201','buyer','Around 40 packs/min. Our festive season starts in 3 weeks, so we need to decide this week. Please send the quote urgently.',1,'09:15'),
 ('11202','buyer','Do your vertical form fill seal machines support nitrogen flushing? We pack whole spices for export.',5,'14:00'),
 ('11202','rep','Yes Anita ma''am, our VFFS model can be fitted with a nitrogen flushing kit.',5,'14:30'),
 ('11202','buyer','Good. Please share the spec sheet and the pouch size range. We will review with our production head.',3,'11:10'),
 ('11203','buyer','We want to replace our manual capping line. Can you share a quote for an automatic capping machine, 60 bottles/min?',4,'16:45'),
 ('11203','rep','Sure, sending the details by tomorrow.',4,'17:00'),
 ('11203','buyer','Still waiting for the quotation. Our management meeting is on Friday and I need to present options.',2,'10:30'),
 ('11204','buyer','Interested in a tea bag packing machine. Just collecting info for now, budget planning is for next quarter.',8,'12:00'),
 ('11204','rep','Understood Kavita ma''am. I have emailed the brochure. Happy to arrange a demo whenever you are ready.',6,'15:20'),
 ('11205','rep','Hello Suresh ji, following up on the shrink wrapping machine quotation we sent. Any questions?',16,'11:00'),
 ('11205','rep','Hi Suresh ji, just checking if you had a chance to review the quote.',12,'10:00'),
 ('11206','buyer','We need a vacuum packaging machine for frozen prawns. Does it handle wet products?',6,'09:40'),
 ('11206','rep','Yes, the double-chamber model is built for wet seafood. Would you like a video demo?',6,'10:15'),
 ('11206','buyer','Yes, please arrange a video demo. Also please call me back on Monday after 3 PM to discuss.',4,'18:05'),
 ('11207','buyer','Not looking at new machines this year. We just bought a blister packer from another vendor. Please don''t contact us again for now.',20,'13:00'),
 ('11208','buyer','We are finalising a 25kg rice bag filling and stitching machine. Your quote is shortlisted along with one other.',3,'11:30'),
 ('11208','rep','Thank you Lakshmi ma''am! Is there anything we can clarify to help you decide?',3,'11:45'),
 ('11208','buyer','Please confirm installation support and warranty terms. We want to place the PO by this week.',2,'16:00'),
 ('11209','buyer','What is the capacity of your cup filling and sealing machine for curd?',10,'08:30'),
 ('11209','rep','Our rotary model does about 1,800 cups/hour. I can share the full spec sheet.',10,'09:00'),
 ('11209','buyer','Ok. Let me discuss with my partner and get back to you.',8,'19:20'),
 ('11214','buyer','Need a flow wrap machine for chocolate bars. Can you share a quotation and the lead time?',3,'12:10'),
 ('11214','rep','Sure Pooja ma''am. What is the bar size and the wrapping film you use?',3,'12:30'),
 ('11214','buyer','100g bars, BOPP film. Please call me in 2 weeks, our director is travelling till then.',3,'13:00'),
 ('11221','buyer','Our current cashew pouch sealer broke down. Need a replacement band sealer urgently, can you dispatch quickly?',2,'08:50'),
 ('11221','rep','Sorry to hear that Ravi ji. Let me check stock and revert today.',2,'09:10')
) AS m(ph, sender, body, days, t)
JOIN public.leads ld ON ld.phone_normalized = '9198450' || m.ph;

INSERT INTO public.analyses (lead_id, status, source, classification, reason, next_follow_up_date, do_not_contact, urgent, suggested_message, draft_message, analyzed_at)
SELECT ld.id, 'done', 'sample', a.cls, a.reason, CASE WHEN a.nd IS NULL THEN NULL ELSE current_date + a.nd END, a.dnc, a.urg, a.msg, a.msg, now()
FROM (VALUES
 ('11201','Hot','Buyer needs the pouch filler quote urgently and must decide this week before the festive season.',-1,false,true,'Hi Ramesh ji, sharing the quotation for the automatic pouch filling machine for 40 packs/min shortly. Could we have a quick call today to go through it before your decision this week?'),
 ('11202','Warm','Buyer asked for spec sheet and pouch size range to review with the production head.',0,false,false,'Hi Anita ma''am, I''m sending the VFFS spec sheet with the nitrogen flushing option and pouch size range. Happy to join a call with your production head if useful.'),
 ('11203','Hot','Buyer is waiting on a promised capping machine quotation for a Friday management meeting.',-1,false,true,'Hi Mohammed ji, apologies for the delay. I''m sending the automatic capping machine quotation for 60 bottles/min today so you have it well before Friday''s meeting.'),
 ('11204','Cold','Buyer is only collecting information with budget planned for next quarter.',8,false,false,'Hi Kavita ma''am, hope you are well. Just checking if you had a chance to look at the tea bag machine brochure. Happy to schedule a demo whenever it suits your planning.'),
 ('11205','Cold','Buyer has not replied to two follow-ups on the shrink wrapping quotation.',-2,false,false,'Hi Suresh ji, hope all is well. Is the shrink wrapping machine still on your plans? If timing has changed, just let me know and I''ll check back later.'),
 ('11206','Hot','Buyer requested a video demo and an explicit callback on Monday after 3 PM.',0,false,true,'Hi Deepa ma''am, as requested I''ll call you today after 3 PM to discuss the vacuum packaging machine and fix a time for the video demo.'),
 ('11207','Cold','Buyer recently bought from another vendor and asked not to be contacted for now.',NULL,true,false,'No follow-up recommended: the buyer asked not to be contacted for now.'),
 ('11208','Hot','Buyer has shortlisted our quote and wants to place the PO this week after confirming installation and warranty.',0,false,true,'Hi Lakshmi ma''am, thank you for shortlisting us. Let me confirm the installation support and warranty terms for the rice bag filling and stitching machine today so you can proceed this week.'),
 ('11209','Warm','Buyer is interested in the cup filler but is discussing with a partner before deciding.',-1,false,false,'Hi Farhan ji, hope the discussion with your partner went well. Do you have any questions on the cup filling and sealing machine I can help with?'),
 ('11210','Cold','No conversation recorded and last contact was over two weeks ago.',-1,false,false,'Hi Nisha ma''am, this is from our packaging machines team. Are you currently looking at any packaging equipment for your cosmetics line? Happy to share options.'),
 ('11211','Warm','Trade show lead with no conversation yet; worth an introductory follow-up.',1,false,false,'Hi Gopal ji, it was good to connect at the trade show. Could you share which pickle packaging machines you are exploring so I can send relevant options?'),
 ('11212','Warm','Facebook ad lead with no recorded conversation; needs a first contact.',0,false,false,'Hi Meera ma''am, thanks for your interest in our packaging machines. What products are you looking to pack so I can suggest suitable options?'),
 ('11213','Cold','Cold call lead with no conversation and no contact for a month.',3,false,false,'Hi Sanjay ji, checking in from our packaging machines team. Are you considering any packaging equipment for your hardware products this year?'),
 ('11214','Warm','Buyer wants a flow wrap quote but asked for a call back in two weeks when the director returns.',11,false,false,'Hi Pooja ma''am, as discussed I''m calling back now that your director is back. Shall we go through the flow wrap machine options for your 100g chocolate bars?'),
 ('11215','Warm','Referral lead with no recorded conversation yet.',-1,false,false,'Hi Imran ji, we were referred to you for packaging machines. Are you looking at any equipment for spice and masala packing?'),
 ('11216','Cold','IndiaMART lead with no conversation recorded.',2,false,false,'Hi Rekha ma''am, thanks for your enquiry on IndiaMART. What kind of coir products do you want to pack?'),
 ('11217','Cold','Trade show lead with no conversation and no contact for over two weeks.',-3,false,false,'Hi Ajay ji, following up from the trade show. Are you exploring any packaging machines for your chemical products?'),
 ('11218','Warm','Facebook ad lead with no recorded conversation yet.',0,false,false,'Hi Sunita ma''am, thanks for your interest. Which sweets are you looking to pack, so I can suggest suitable machines?'),
 ('11219','Warm','Website enquiry with no conversation recorded yet.',1,false,false,'Hi Naveen ji, thanks for your website enquiry. Which frozen food products are you looking to pack?'),
 ('11220','Warm','Referral lead with no recorded conversation yet.',-2,false,false,'Hi Divya ma''am, we were referred to you regarding packaging machines. What pet food pack sizes are you working with?'),
 ('11221','Hot','Buyer''s sealer broke down and urgently needs a replacement band sealer.',-1,false,true,'Hi Ravi ji, following up on your band sealer replacement. Let me confirm stock availability with you today so we can plan the next step quickly.'),
 ('11222','Cold','Cold call lead with no conversation and no contact for nearly a month.',5,false,false,'Hi Alok ji, checking in from our packaging machines team. Do you have any requirements for seed packing equipment?')
) AS a(ph, cls, reason, nd, dnc, urg, msg)
JOIN public.leads ld ON ld.phone_normalized = '9198450' || a.ph;