// Copied from texas-stores-management-test (spreadsheet seed). Used only if the live import fails.
// Seed data extracted from the Google Sheet "Inventory & Costing Tracker"
// Tabs: Main, BOM / Recipes, Pricing Dashboard, Mixes  (as of 2026-07-27)

// [code, name, unit, purchaseUnits, pricePerPU, costPerUnit, provider1, p1Price, provider2, p2Price]
const ingredients = [
  ["1001","Elote Desgranado","oz",480,40.50,0.0844,"Taxco",40.50,"Winco",45.00],
  ["1002","Elote Entero","each",36,32.50,0.9028,"Taxco",32.50,"El Rancho",36.00],
  ["1003","Lime Natural","oz",64,9.64,0.1506],
  ["1004","Lime Regular","oz",128,9.04,0.0706],
  ["1005","Mayonesa","oz",132,22.30,0.1689],
  ["1006","Crema","oz",80,30.87,0.3859],
  ["1007","Mantequilla","oz",274,24.70,0.0901],
  ["1008","Queso Cotija","oz",80,28.62,0.3578],
  ["1009","Queso Romano","oz",80,15.56,0.1945],
  ["1010","Valentina Regular","oz",128,9.67,0.0755],
  ["1011","Taro Powder","oz",36,17.00,0.4722],
  ["1012","Fresa Powder","oz",56,29.70,0.5304],
  ["1013","Vanilla Powder","oz",56,24.50,0.4375],
  ["1014","Frappucino Powder","oz",56,24.50,0.4375],
  ["1015","Horchata Powder","oz",56,37.69,0.6730],
  ["1016","Leche Condensada","oz",14,2.97,0.2121],
  ["1017","Harina","oz",80,2.58,0.0323],
  ["1018","Fresa Frescas","oz",16,2.50,0.1563],
  ["1019","Whipped Cream","oz",15,3.68,0.2453],
  ["1020","Bananos","each",1,0.50,0.5000],
  ["1021","Nutella","oz",116.16,28.66,0.2467],
  ["1022","Chocolate Syrup","oz",24,5.33,0.2221],
  ["1023","Caramel Syrup","oz",22,5.12,0.2327],
  ["1024","Azucar En polvo","oz",32,2.02,0.0631],
  ["1025","Azucar regular","oz",64,3.27,0.0511],
  ["1026","Azucar Syrup","oz",880,46.75,0.0531],
  ["1027","Boba pearls","oz",112,19.00,0.1696],
  ["1028","cayenne","oz",80,15.26,0.1908],
  ["1029","paprika","oz",80,20.82,0.2603],
  ["1030","Conchitas","each",30,33.40,1.1133],
  ["1031","Doritos","each",24,39.30,1.6375],
  ["1032","Cheetos ingredient","each",32,52.41,1.6378],
  ["1033","Sopas ing.","each",1,0.35,0.3500],
  ["1034","Takis","each",20,40.56,2.0280],
  ["1035","sal","oz",24,1.99,0.0829],
  ["1036","Mango syryp","oz",128,8.76,0.0684],
  ["1037","Coffee Powder ice coffee","oz",56,24.50,0.4375],
  ["1038","Chamoy El Chilerito","oz",33,10.36,0.3139],
  ["1039","Tajin","oz",32,15.24,0.4763],
  ["1040","valentina preparada","oz",19,3.63,0.1913],
  ["1041","Crepa mix","oz",93,4.06,0.0437],
  ["1042","Milk","oz",128,3.00,0.0234],
  ["1043","Strawberries fresh","oz",16,2.50,0.1563],
  ["1044","Crema preparada fresa","oz",41,14.29,0.3486],
  ["1045","Granola","oz",64,15.85,0.2477],
  ["1046","Chocolate nieve","oz",128,7.27,0.0568],
  ["1047","Vanilla nieve","oz",128,7.27,0.0568],
  ["1048","Cookies and cream nieve","oz",128,7.27,0.0568],
  ["1049","Water","oz",256,3.00,0.0117],
  ["1050","Ice","oz",256,0.01,0.0117],
  ["1051","Strawberry Syrup","oz",128,8.76,0.0684],
  ["1052","Tamarindo Syrup","oz",128,9.82,0.0767],
  ["1053","Mango Chuncks","oz",160,0.13,0.1267],
  ["1054","Xanta Gum","oz",8,5.44,0.6800],
  ["1055","mango chamomix","oz",40.5,0.13,0.1300],
  ["1056","tamarindo chamomix","oz",null,null,0],
  ["1057","Fresa chamomix","oz",40,1.63,0.0408],
  ["1058","fresa chamo mix","oz",40,1.63,0.3570],
  ["1059","Vanilla extract","oz",8,1.89,0.2363],
  ["1060","Heavy Cream","oz",64,9.54,0.1491],
  ["1061","Strawberry frozen","oz",160,14.28,0.0893],
  ["1062","Watermelon ice","oz",320,0.08,0.0812],
  ["1063","fructose liquid sugar","oz",880,47.00,0.0534],
  ["1064","Oreo Cookie","oz",13,3.96,0.3046],
  ["1065","Strawberry Nieve","oz",48,2.50,0.0521],
  ["1066","Tamarindo Pulpa","oz",14,3.23,0.2307],
  ["1067","Eggs","each",60,7.13,0.1188],
  ["1068","Flour","oz",80,2.58,0.0323],
  ["1069","coffee powder","oz",8,5.77,0.7213],
  ["1070","tiger milk concentrate","oz",null,null,0],
  ["1071","mango peach concentrate","oz",64,4.27,0.0667],
  ["1072","dragon fruit chuncks","oz",12,5.12,0.4267],
  ["1073","Cinnamon powder","oz",2.5,1.38,0.5520],
  ["1074","Coconut milk","oz",64,4.64,0.0725],
  ["1075","Strawberry acai juice","oz",32,8.97,0.2803],
  ["1076","coconut syrup","oz",13,2.12,0.1631],
  ["1077","Red bull can","each",24,59.00,2.4583],
  ["1078","Tostitos Bag","each",28,45.85,1.6375],
  ["2001","White Cup 16/20","each",500,40.97,0.0819],
  ["2002","White Cup 12oz","each",1000,47.45,0.0475],
  ["2003","Clear Cup 16oz","each",1000,57.09,0.0571],
  ["2004","Clear Cup 20oz","each",600,46.22,0.0770],
  ["2005","Clear Cup 24oz","each",600,52.73,0.0879],
  ["2006","Clear lid 16/24","each",100,4.00,0.0400],
  ["2007","Dome lid","each",100,5.00,0.0500],
  ["3006","Popotes boba","each",1600,39.75,0.0248],
  ["3007","portavasos","each",300,38.00,0.1267],
  ["3008","Popotes Regulares","each",2000,16.00,0.0080],
  ["3009","Flechazos","each",50,12.59,0.2518],
  ["3010","Cucharas cortas","each",1000,7.34,0.0073],
  ["3011","Cucharas largas","each",1000,32.33,0.0323],
  ["3012","Tenedores","each",1000,7.34,0.0073],
  ["3013","Cuchillos","each",1000,7.34,0.0073],
  ["3014","Servilletas","each",500,12.74,0.0255],
  ["3015","Bandejas charolas","each",200,23.27,0.1164],
  ["3016","Bolsas","each",500,18.37,0.0367],
  ["3017","Otros 3017","each",300,40.24,0.1341]
];

// [code, name, priceCents]  (Pricing Dashboard "Actual Price"; null = no price set)
const products = [
  ["4001","Vaso chico",500],
  ["4002","Vaso Grande",700],
  ["4003","Cheetos",700],
  ["4004","Conchitas",700],
  ["4005","Crepas",800],
  ["4006","Sopa FP",500],
  ["4007","Tostitos",700],
  ["4008","Doritos",700],
  ["4009","Takis",700],
  ["4010","Fresas con crema",700],
  ["4011","Queso extra",100],
  ["4012","Vaso nieve 1",250],
  ["4013","Vaso nieve 2",500],
  ["4014","Chamoyada tamarindo",700],
  ["4015","Chamoyada fresa",700],
  ["4016","Chamoyada mango",700],
  ["4017","Chamoyada sandia",700],
  ["4018","Coco rosa",500],
  ["4019","Horchata Canela",500],
  ["4020","Horchata Fresa",500],
  ["4021","Limonada",null],
  ["4022","Mango Peach dragonfruit",700],
  ["4023","Red bull preparado",650],
  ["4024","Strawberry acai",500],
  ["4025","Caramel frappuccino",700],
  ["4026","Cookies and Cream",700],
  ["4027","Malteada Chocolate",700],
  ["4028","Malteada fresa",700],
  ["4029","Malteada taro",700],
  ["4030","Malteada vanilla",700],
  ["4031","Boba coffee",700],
  ["4032","Boba customized",500],
  ["4033","Boba strawberry",500],
  ["4034","Boba taro",500],
  ["4035","Cafe",null],
  ["4036","Chocolate",null],
  ["4037","Chocolate cafe",null],
  ["4038","Hot taro",500],
  ["4039","Tiger milk",700]
];

// [productCode, componentType, ingredientCode, quantity]
const bom = [
  ["4001","Ingredient","1001",8],["4001","Ingredient","1003",1],["4001","Ingredient","1005",1],
  ["4001","Ingredient","1006",1],["4001","Ingredient","1007",1],["4001","Ingredient","1008",1],
  ["4001","Ingredient","1009",1],["4001","Ingredient","1010",1],["4001","Ingredient","1035",0.1],
  ["4001","Ingredient","2002",1],["4001","Packaging","3014",2],["4001","Packaging","3010",1],

  ["4002","Ingredient","1001",12],["4002","Ingredient","1003",1],["4002","Ingredient","1005",2],
  ["4002","Ingredient","1006",2],["4002","Ingredient","1007",2],["4002","Ingredient","1008",1],
  ["4002","Ingredient","1009",1],["4002","Ingredient","1039",0.1],["4002","Ingredient","1010",1],
  ["4002","Packaging","2001",1],["4002","Packaging","3010",1],["4002","Packaging","3014",2],
  ["4002","Disposable","3007",0.1],

  ["4003","Ingredient","1032",1],["4003","Ingredient","1001",4],["4003","Ingredient","1003",1],
  ["4003","Ingredient","1005",1],["4003","Ingredient","1006",1],["4003","Ingredient","1007",1],
  ["4003","Ingredient","1010",1],["4003","Ingredient","1009",1],["4003","Ingredient","1008",1],
  ["4003","Packaging","3014",2],["4003","Packaging","3010",1],

  ["4004","Ingredient","1001",5],["4004","Ingredient","1005",1],["4004","Ingredient","1006",1],
  ["4004","Ingredient","1007",1],["4004","Ingredient","1008",1],["4004","Ingredient","1009",1],
  ["4004","Ingredient","1010",1],["4004","Ingredient","1003",1],["4004","Ingredient","1030",1],
  ["4004","Disposable","3010",1],["4004","Disposable","3014",2],

  ["4005","Ingredient","1041",5],["4005","Ingredient","1043",4],["4005","Ingredient","1020",0.5],
  ["4005","Ingredient","1021",3],["4005","Ingredient","1022",2],["4005","Packaging","3015",1],
  ["4005","Disposable","3014",2],["4005","Disposable","3012",1],["4005","Disposable","3016",1],
  ["4005","Disposable","1024",1],

  ["4006","Ingredient","1001",4],["4006","Ingredient","1003",1],["4006","Ingredient","1005",1],
  ["4006","Ingredient","1006",1],["4006","Ingredient","1007",1],["4006","Ingredient","1010",1],
  ["4006","Ingredient","1033",1],

  ["4007","Ingredient","1001",6],["4007","Ingredient","1003",1],["4007","Ingredient","1006",1],
  ["4007","Ingredient","1007",1],["4007","Ingredient","1008",1],["4007","Ingredient","1009",1],
  ["4007","Ingredient","1010",1],["4007","Ingredient","1078",1],["4007","Ingredient","1005",1],
  ["4007","Disposable","3010",1],["4007","Disposable","3014",2],

  ["4008","Ingredient","1031",1],["4008","Ingredient","1001",4],["4008","Ingredient","1006",1],
  ["4008","Ingredient","1007",1],["4008","Ingredient","1005",1],["4008","Ingredient","1008",1],
  ["4008","Ingredient","1009",1],["4008","Ingredient","1010",1],["4008","Ingredient","1003",1],
  ["4008","Disposable","3010",1],["4008","Disposable","3014",2],

  ["4009","Ingredient","1034",1],["4009","Ingredient","1001",4],["4009","Ingredient","1006",1],
  ["4009","Ingredient","1007",1],["4009","Ingredient","1005",1],["4009","Ingredient","1008",1],
  ["4009","Ingredient","1009",1],["4009","Ingredient","1003",1],["4009","Ingredient","1010",1],
  ["4009","Disposable","3010",1],["4009","Disposable","3014",2],

  ["4010","Ingredient","1018",8],["4010","Ingredient","1044",4],["4010","Ingredient","1045",2],
  ["4010","Packaging","2003",1],["4010","Packaging","2007",1],["4010","Disposable","3011",1],
  ["4010","Disposable","3014",2],

  ["4011","Ingredient","1008",1],["4011","Ingredient","1009",1],

  ["4012","Ingredient","1047",4],

  ["4013","Ingredient","1047",8],

  ["4014","Ingredient","1066",5],["4014","Ingredient","1050",12],["4014","Ingredient","1052",4],
  ["4014","Ingredient","1025",8],["4014","Ingredient","1049",4],["4014","Ingredient","1054",0.25],
  ["4014","Packaging","2004",1],["4014","Packaging","2006",1],["4014","Disposable","3014",2],
  ["4014","Disposable","3006",1],

  ["4015","Ingredient","1057",16],["4015","Ingredient","1038",4],["4015","Ingredient","1039",2],
  ["4015","Disposable","3009",1],["4015","Disposable","3011",1],["4015","Disposable","3014",2],
  ["4015","Packaging","2004",1],["4015","Packaging","2007",0],

  ["4016","Ingredient","1055",8],["4016","Ingredient","1038",2],["4016","Ingredient","1039",1],
  ["4016","Ingredient","1050",6],["4016","Disposable","3009",1],["4016","Disposable","3011",1],
  ["4016","Disposable","3014",2],["4016","Packaging","2004",1],["4016","Packaging","2007",1],

  ["4017","Ingredient","1062",16],["4017","Ingredient","1038",4],["4017","Ingredient","1039",2],
  ["4017","Packaging","2005",1],["4017","Packaging","2006",1],["4017","Disposable","3014",2],
  ["4017","Disposable","3011",1],

  ["4018","Ingredient","1075",4],["4018","Ingredient","1074",4],["4018","Ingredient","1043",4],
  ["4018","Ingredient","1076",2],["4018","Ingredient","1051",2],["4018","Ingredient","1050",8],
  ["4018","Packaging","2004",1],["4018","Packaging","2006",1],["4018","Disposable","3014",2],
  ["4018","Disposable","3006",1],

  ["4019","Ingredient","1042",16],["4019","Ingredient","1015",2],["4019","Ingredient","1050",8],
  ["4019","Ingredient","1073",0.25],["4019","Packaging","2005",1],["4019","Packaging","2006",1],
  ["4019","Disposable","3014",2],["4019","Disposable","3008",1],

  ["4020","Ingredient","1015",2],["4020","Ingredient","1042",8],["4020","Ingredient","1050",8],
  ["4020","Ingredient","1051",2],["4020","Ingredient","1018",2],["4020","Packaging","2004",1],
  ["4020","Packaging","2006",1],["4020","Disposable","3014",2],["4020","Disposable","3006",1],

  ["4022","Ingredient","1003",2],["4022","Ingredient","1071",4],["4022","Ingredient","1072",4],
  ["4022","Ingredient","1050",8],["4022","Packaging","2005",1],["4022","Packaging","2006",1],
  ["4022","Disposable","3014",2],["4022","Disposable","3006",1],

  ["4023","Ingredient","1077",1],["4023","Ingredient","1038",2],["4023","Ingredient","1003",2],
  ["4023","Ingredient","1039",1],["4023","Ingredient","1050",8],["4023","Packaging","2004",1],
  ["4023","Packaging","2006",1],["4023","Disposable","3014",2],["4023","Disposable","3008",1],

  ["4024","Ingredient","1075",8],["4024","Ingredient","1050",8],["4024","Packaging","2005",1],
  ["4024","Packaging","2006",1],["4024","Disposable","3014",2],["4024","Disposable","3006",1],

  ["4025","Ingredient","1024",3],["4025","Ingredient","1050",4],["4025","Ingredient","1047",8],
  ["4025","Ingredient","1042",8],["4025","Ingredient","1063",1],["4025","Ingredient","1016",1],
  ["4025","Packaging","2005",1],["4025","Packaging","2006",1],["4025","Disposable","3008",1],
  ["4025","Disposable","3014",2],

  ["4026","Ingredient","1050",4],["4026","Ingredient","1048",8],["4026","Ingredient","1042",8],
  ["4026","Ingredient","1063",2],["4026","Ingredient","1016",2],["4026","Ingredient","1064",1],
  ["4026","Packaging","2005",1],["4026","Packaging","2006",1],["4026","Disposable","3014",2],
  ["4026","Disposable","3006",1],

  ["4027","Ingredient","1050",4],["4027","Ingredient","1046",5],["4027","Ingredient","1042",8],
  ["4027","Ingredient","1063",2],["4027","Ingredient","1016",2],["4027","Ingredient","1022",3],
  ["4027","Packaging","2006",1],["4027","Packaging","2005",1],["4027","Disposable","3014",2],
  ["4027","Disposable","3006",1],

  ["4028","Ingredient","1050",4],["4028","Ingredient","1065",8],["4028","Ingredient","1042",8],
  ["4028","Ingredient","1063",2],["4028","Ingredient","1016",2],["4028","Packaging","2005",1],
  ["4028","Packaging","2006",1],["4028","Disposable","3014",2],["4028","Disposable","3006",1],

  ["4029","Ingredient","1050",4],["4029","Ingredient","1047",5],["4029","Ingredient","1011",3],
  ["4029","Ingredient","1042",8],["4029","Ingredient","1063",1],["4029","Ingredient","1016",1],
  ["4029","Packaging","2005",1],["4029","Packaging","2006",1],["4029","Disposable","3014",2],
  ["4029","Disposable","3008",1],

  ["4030","Ingredient","1050",4],["4030","Ingredient","1047",5],["4030","Ingredient","1042",8],
  ["4030","Ingredient","1063",2],["4030","Ingredient","1016",2],["4030","Packaging","2004",1],
  ["4030","Packaging","2006",1],["4030","Disposable","3006",1],["4030","Disposable","3014",2],

  ["4031","Ingredient","1042",16],["4031","Ingredient","1069",1],["4031","Ingredient","1063",2],
  ["4031","Ingredient","1016",2],["4031","Packaging","2004",1],["4031","Packaging","2006",1],
  ["4031","Disposable","3006",1],["4031","Disposable","3014",2],

  ["4033","Ingredient","1042",8],["4033","Ingredient","1012",2],["4033","Ingredient","1063",2],
  ["4033","Ingredient","1016",2],["4033","Packaging","2001",1],["4033","Packaging","2006",1],
  ["4033","Disposable","3006",1],["4033","Disposable","3014",2],

  ["4034","Ingredient","1042",8],["4034","Ingredient","1011",2],["4034","Ingredient","1063",2],
  ["4034","Ingredient","1016",2],["4034","Packaging","2004",1],["4034","Packaging","2006",1],
  ["4034","Disposable","3006",1],["4034","Disposable","3014",2],

  ["4038","Ingredient","1011",2],["4038","Ingredient","1049",8],["4038","Packaging","2001",1],
  ["4038","Packaging","2006",1],["4038","Disposable","3014",2],

  ["4039","Ingredient","1042",8],["4039","Ingredient","1013",2],["4039","Ingredient","1063",2],
  ["4039","Ingredient","1016",2],["4039","Packaging","2004",1],["4039","Packaging","2006",1],
  ["4039","Disposable","3014",2],["4039","Disposable","3006",1]
];

// POS item name -> product code (kind: product | zerocost | ignore)
const posMaps = [
  ["Elote Chico","product","4001"],
  ["Elote Grande","product","4002"],
  ["Cheetos","product","4003"],
  ["Conchitas","product","4004"],
  ["Crepas","product","4005"],
  ["Sopa","product","4006"],
  ["Tostitos","product","4007"],
  ["Doritos","product","4008"],
  ["Takis","product","4009"],
  ["Fresa Con Crema 16 oz","product","4010"],
  ["Queso Extra","product","4011"],
  ["Vaso Nieve 1 Scoop","product","4012"],
  ["Vaso Nieve 2 Scoops","product","4013"],
  ["Chamoyada de Tamarindo","product","4014"],
  ["Chamoyada Fresa","product","4015"],
  ["Chamoyada Mango","product","4016"],
  ["Chamoyada Sandía","product","4017"],
  ["Coco Rosa","product","4018"],
  ["Horchata Canela","product","4019"],
  ["Horchata Fresa","product","4020"],
  ["Limonada","product","4021"],
  ["Mango Peach Dragonfruit","product","4022"],
  ["Red Bull Preparado","product","4023"],
  ["Strawberry Acai","product","4024"],
  ["Caramel Frappuccino","product","4025"],
  ["Cookies and Cream","product","4026"],
  ["Malteada Chocolate","product","4027"],
  ["Malteada de Fresa","product","4028"],
  ["Malteada de Taro","product","4029"],
  ["Malteada Vainilla","product","4030"],
  ["Boba Coffee","product","4031"],
  ["Boba Customized","product","4032"],
  ["Boba Strawberry","product","4033"],
  ["Boba Taro","product","4034"],
  ["Cafe","product","4035"],
  ["Chocolate","product","4036"],
  ["Chocolate Cafe","product","4037"],
  ["Hot Taro","product","4038"],
  ["Tiger Milk","product","4039"],
  ["Toppings","zerocost",null],
  ["Discount","zerocost",null]
  // "Elote Entero" left unmapped on purpose: it has no BOM yet.
];

// Mixes tab
const mixes = [
  { name: "Crema preparada fresa", linkedIngredientCode: "1044", lines: [
    ["sour cream",24,9.26],["condensed milk",12,2.55],["heavy cream",4,0.5963],["vanilla",1,1.89]
  ]},
  { name: "Valentina preparada", linkedIngredientCode: "1040", lines: [
    ["Cayenne",10,1.91],["Paprika",4,1.04],["Limon natural",4,0.6025],["sal",1,0.0829]
  ]},
  { name: "Chamoyada prep mango", linkedIngredientCode: "1055", lines: [
    ["mango chuncks",12,1.52],["ice",12,0.14],["syrup",4,0.2738],["water",4,0.0469],
    ["sugar",8,0.4088],["xanta gum",0.5,2.72]
  ]},
  { name: "Chamoyada prep fresa", linkedIngredientCode: "1057", lines: [
    ["strawberry frozen",8,0.71],["ice",16,0.19],["strawberry syrup",4,0.2738],
    ["water",4,0.0469],["sugar",8,0.4088]
  ]},
  { name: "Crepas mix", linkedIngredientCode: "1041", lines: [
    ["harina",32,1.03],["leche",40,0.94],["huevos",8,0.9507],["sugar",8,0.4088],
    ["vanilla",2,0.4725],["mantequilla",2,0.1803],["sal",1,0.0829]
  ]}
];

module.exports = { ingredients, products, bom, posMaps, mixes };
