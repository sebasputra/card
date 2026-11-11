/* Bio Card Stephen, profil umum. */
var DATA = {
  "version": 2,
  "id": "stephen",
  "lang_default": "id",
  "images": {
    "cover": "img/stephen-hd.jpg",
    "hero": "img/stephen-hd.jpg",
    "logo": "img/increasink.png"
  },
  "hero": {
    "name": "Stephen Septian",
    "initials": "SS",
    "role_id": "Founder & Creative Director, Increasink",
    "role_en": "Founder & Creative Director, Increasink",
    "connector_id": "Bio Card",
    "connector_en": "Bio Card",
    "meta": "Business, Brand & People"
  },
  "contact": {
    "wa": "62817714647",
    "phone_display": "+62 817 714 647",
    "email": "stephen@increasink.co.id",
    "ig": "stephenseptian",
    "linkedin": "stephen-septian",
    "web": "increasink.co.id",
    "vcf_note": "Founder & Creative Director Increasink, branding dan storytelling"
  },
  "wa_form": {
    "head_id": "Mari terhubung",
    "head_en": "Let's connect",
    "sub_id": "Kenalkan diri dan ceritakan yang ingin dibicarakan.",
    "sub_en": "Introduce yourself and tell me what you have in mind.",
    "fields": [
      {
        "key": "name",
        "label_id": "Nama",
        "label_en": "Name",
        "autocomplete": "name",
        "required": true
      },
      {
        "key": "brand",
        "label_id": "Perusahaan atau brand (opsional)",
        "label_en": "Company or brand (optional)",
        "autocomplete": "organization"
      },
      {
        "key": "message",
        "label_id": "Yang ingin dibicarakan",
        "label_en": "What you have in mind",
        "required": true
      }
    ],
    "template_id": "Halo Pak Stephen, saya {name} dari {brand}. Saya ingin ngobrol tentang {message}.\n\nProfil: {link}\nSimpan kontak: {vcf}",
    "template_en": "Hi Stephen, I am {name} from {brand}. I would like to talk about {message}.\n\nProfile: {link}\nSave contact: {vcf}"
  },
  "pages": [
    {
      "key": "about",
      "icon": "person",
      "tab_id": "Kenalan",
      "tab_en": "About",
      "label_id": "Perkenalan",
      "label_en": "Introduction",
      "widgets": [
        {
          "id": "about-photo",
          "type": "image",
          "src": "img/stephen-hd.jpg",
          "caption_id": "Stephen Septian",
          "caption_en": "Stephen Septian"
        },
        {
          "id": "about-profile",
          "type": "profile"
        },
        {
          "id": "about-position",
          "type": "text",
          "style": "quote",
          "body_id": "Business, Brand & People: <em>pelajaran dari membangun, menghubungkan, dan menumbuhkan.</em>",
          "body_en": "Business, Brand & People: <em>lessons from building, connecting and growing.</em>"
        }
      ]
    },
    {
      "key": "work",
      "icon": "badge",
      "tab_id": "Increasink",
      "tab_en": "Increasink",
      "label_id": "Tentang Increasink",
      "label_en": "About Increasink",
      "widgets": [
        {
          "id": "work-title",
          "type": "heading",
          "text_id": "Brand dengan strategi dan cerita.",
          "text_en": "Brands built with strategy and story."
        },
        {
          "id": "work-description",
          "type": "text",
          "body_id": "Increasink adalah branding dan digital creative agency. Kami membantu bisnis mengomunikasikan value-nya lewat brand strategy, identitas visual, social media, dan storytelling.",
          "body_en": "Increasink is a branding and digital creative agency. We help businesses communicate their value through brand strategy, visual identity, social media, and storytelling."
        },
        {
          "id": "work-reel",
          "type": "showreel",
          "src": "img/ourworks.mp4",
          "poster": "img/ourworks-poster.webp",
          "loop": "img/ourworks-loop.mp4",
          "label_id": "Lihat karya kami",
          "label_en": "Explore our work",
          "note_id": "Buka showreel",
          "note_en": "Open showreel"
        },
        {
          "id": "work-web",
          "type": "button",
          "label_id": "Kenali Increasink",
          "label_en": "Meet Increasink",
          "url": "https://increasink.co.id"
        }
      ]
    },
    {
      "key": "connect",
      "icon": "chat",
      "tab_id": "Kontak",
      "tab_en": "Contact",
      "label_id": "Mari terhubung",
      "label_en": "Let's connect",
      "dark": true,
      "widgets": [
        {
          "id": "contact-title",
          "type": "heading",
          "text_id": "Mulai dari percakapan.",
          "text_en": "Start with a conversation."
        },
        {
          "id": "contact-links",
          "type": "contact"
        },
        {
          "id": "contact-share",
          "type": "share"
        }
      ]
    }
  ]
};
