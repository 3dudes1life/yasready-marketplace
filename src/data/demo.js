export const account={userId:'demo-user-william',name:'William T. Zakrajshek',email:'demo@yasready.local',authorId:'william',handle:'william-zakrajshek',sharedAccount:true};

export const books = [
  {
    id:'taul-1',slug:'tres-amigos-una-vida',title:'Tres Amigos, Una Vida',subtitle:'A Throuple Love Story',author:'William T. Zakrajshek',authorId:'william',handle:'william-zakrajshek',series:'Tres Amigos, Una Vida',seriesNumber:1,
    description:'Three lives collide across friendship, love, reinvention, and the messy work of building a life that does not follow the usual rules.',
    longDescription:'A relationship-first contemporary story about Michael, Juan, and Christopher as friendship becomes something larger, complicated, and worth fighting for.',
    cover:'linear-gradient(145deg,#ee6f2d,#f6a33e 52%,#f7c06a)',accent:'#ee6f2d',rating:4.8,reviews:28,categories:['LGBTQ+ Romance','Contemporary Fiction'],featured:true,listingStatus:'live',publishingSourceId:'publishing-demo-book-1',
    editions:[
      {id:'taul1-ebook',format:'Ebook',price:5.99,priceMinor:599,isbn:'9780000000001',status:'live',fulfillment:'yasready-digital',inventoryStatus:'available'},
      {id:'taul1-paper',format:'Paperback',price:16.99,priceMinor:1699,isbn:'9780000000002',status:'live',fulfillment:'ingram',inventoryStatus:'available'},
      {id:'taul1-hard',format:'Hardcover',price:24.99,priceMinor:2499,isbn:'9780000000003',status:'live',fulfillment:'ingram',inventoryStatus:'available'},
      {id:'taul1-audio',format:'Audiobook',price:9.99,priceMinor:999,isbn:null,status:'coming-soon',fulfillment:'yasready-digital',inventoryStatus:'preparing'}
    ]
  },
  {
    id:'taul-2',slug:'fault-lines',title:'Fault Lines',subtitle:'Tres Amigos, Una Vida — Book Two',author:'William T. Zakrajshek',authorId:'william',handle:'william-zakrajshek',series:'Tres Amigos, Una Vida',seriesNumber:2,
    description:'Love survives the easy moments. Fault Lines asks what happens when the ground underneath all three of them begins to move.',
    longDescription:'Book Two pushes the relationship into sharper territory: distance, family, fear, repair, and whether choosing each other is enough when everything around them changes.',
    cover:'linear-gradient(145deg,#1a1a1e,#413957 58%,#8f79b8)',accent:'#735fa0',rating:4.6,reviews:16,categories:['LGBTQ+ Romance','Contemporary Fiction'],featured:true,listingStatus:'live',publishingSourceId:'publishing-demo-book-2',
    editions:[
      {id:'fault-ebook',format:'Ebook',price:5.99,priceMinor:599,isbn:'9780000000011',status:'live',fulfillment:'yasready-digital',inventoryStatus:'available'},
      {id:'fault-paper',format:'Paperback',price:17.99,priceMinor:1799,isbn:'9780000000012',status:'live',fulfillment:'ingram',inventoryStatus:'available'},
      {id:'fault-hard',format:'Hardcover',price:25.99,priceMinor:2599,isbn:'9780000000013',status:'preparing',fulfillment:'ingram',inventoryStatus:'preparing'},
      {id:'fault-audio',format:'Audiobook',price:9.99,priceMinor:999,isbn:null,status:'planned',fulfillment:'yasready-digital',inventoryStatus:'planned'}
    ]
  },
  {
    id:'demo-3',slug:'the-long-way-home',title:'The Long Way Home',subtitle:'A Novel',author:'Jordan Reyes',authorId:'jordan',handle:'jordan-reyes',series:null,seriesNumber:null,
    description:'A warm, character-driven story about returning home and discovering the place you left has been changing too.',
    longDescription:'A fictional marketplace title used to prove multi-author cart, attribution, payouts, and reporting.',
    cover:'linear-gradient(145deg,#185f67,#4ea9a0 55%,#b6ddca)',accent:'#39877f',rating:4.7,reviews:54,categories:['Contemporary Fiction'],featured:false,listingStatus:'live',
    editions:[
      {id:'long-ebook',format:'Ebook',price:4.99,priceMinor:499,isbn:'9780000000021',status:'live',fulfillment:'yasready-digital',inventoryStatus:'available'},
      {id:'long-paper',format:'Paperback',price:15.99,priceMinor:1599,isbn:'9780000000022',status:'live',fulfillment:'ingram',inventoryStatus:'available'},
      {id:'long-audio',format:'Audiobook',price:11.99,priceMinor:1199,isbn:null,status:'live',fulfillment:'yasready-digital',inventoryStatus:'available'}
    ]
  }
];

export const dashboard={
  period:'Last 30 days',views:2367,grossSales:2486.41,authorEarnings:1621.74,marketplaceFees:124.32,units:137,orders:123,conversionRate:5.2,avgOrderValue:20.21,refunds:2,repeatCustomerRate:18.4,
  formatMix:[{label:'Paperback',value:54,amount:1342.66},{label:'Ebook',value:29,amount:721.06},{label:'Audiobook',value:17,amount:422.69}],
  sources:[
    {source:'Instagram',visits:598,sales:18,revenue:356.82,conversion:3.0},
    {source:'Website embed',visits:221,sales:7,revenue:149.93,conversion:3.2},
    {source:'Event QR',visits:109,sales:11,revenue:207.89,conversion:10.1},
    {source:'Email',visits:186,sales:14,revenue:284.86,conversion:7.5},
    {source:'Direct / unknown',visits:752,sales:31,revenue:618.69,conversion:4.1}
  ],
  daily:[34,52,41,78,66,91,103,88,126,112,141,137,154,189],
  recentOrders:[
    {id:'YR-1048',when:'Today, 2:41 PM',title:'Fault Lines',format:'Paperback',gross:17.99,earnings:11.16,status:'Fulfillment queued'},
    {id:'YR-1047',when:'Today, 1:16 PM',title:'Tres Amigos, Una Vida',format:'Audiobook',gross:9.99,earnings:9.49,status:'Delivered'},
    {id:'YR-1046',when:'Today, 11:03 AM',title:'Tres Amigos, Una Vida',format:'Paperback',gross:16.99,earnings:10.39,status:'Submitted to Ingram'},
    {id:'YR-1045',when:'Yesterday',title:'Fault Lines',format:'Ebook',gross:5.99,earnings:5.69,status:'Delivered'},
    {id:'YR-1044',when:'Yesterday',title:'Fault Lines',format:'Paperback',gross:35.98,earnings:22.32,status:'Shipped'}
  ]
};

export const campaigns=[
  {id:'camp-instagram-launch',bookId:'taul-2',name:'Book Two Launch',source:'instagram',clicks:598,orders:18,revenue:356.82},
  {id:'camp-event-qr',bookId:'taul-1',name:'Pride Event QR',source:'event-qr',clicks:109,orders:11,revenue:207.89},
  {id:'camp-email',bookId:'taul-2',name:'Reader Email',source:'email',clicks:186,orders:14,revenue:284.86}
];
