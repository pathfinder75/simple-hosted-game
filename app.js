
var mongojs = require('mongojs');
var db = mongojs('localhost:27017/myGame', ['account', 'progress']);

// db.account.insert({username:"b", password:"b"});

// var db = null;
const express = require('express');
const path = require('path');
var app = express();
var session = require('express-session');
var cookie = require('cookie');
var cookieParser = require('cookie-parser');
var bodyParser = require('body-parser');
var serv = require('http').Server(app);
var pug = require('pug');
/* configuration */
app.use('/client/public',express.static(__dirname + '/client/public'));
app.set('view engine','pug');
app.set('views', __dirname + '/client/views');
  // Allow parsing cookies from request headers
app.use(cookieParser());
  // Session management
app.use(session({
    // Private crypting key
    secret:'123456789SECRET',
    saveUninitialized : false,
    resave: false,
    // Internal session data storage engine, this is the default engine embedded with connect.
    // Much more can be found as external modules (Redis, Mongo, Mysql, file...). look at "npm search connect session store"
}));
// Allow parsing form data
app.use(bodyParser());
function requireLogin(req, res, next) {
  if (req.session.username) {
    // si l'utilisateur est loggé on le renvoit vers l'index
    next();
  } else {
    // autrement il est redirigé vers login
  res.redirect('/login');
  }
}
app.get('/', [requireLogin], function (req, res, next) {
  // res.sendFile(__dirname + '/client/index.html');
  res.render('index', {"username": req.session.username});
});
// app.get('/',function(req, res) {
//     res.sendFile(__dirname + '/client/index.html');
// });
app.get("/login", function (req, res) {
  // Show form, default value = current username
  res.render("login", { "username": req.session.username, "error": "null" });
});
app.post("/login", function (req, res) {
  var options = { "username": req.body.username, "error": null };
  if (!req.body.username) {
    options.error = "User name is required";
    console.log(options.error);
    res.render("login", options);
  } else if (req.body.username == req.session.username) {
    // User has not changed username, accept it as-is
    res.redirect("/");
  } else if (!req.body.username.match(/^\w{3,}$/)) {
    options.error = "User name must have at least 3 alphanumeric characters";
    res.render("login", options);
  } else {
      // if username is taken :
      db.account.find({ username: req.body.username}, function(err, data) {
          if (data.length > 0) {
              // true
              options.error = "User name is already taken";
              res.render("login", options);
          } else {
              // false
              req.session.username = req.body.username;
              res.redirect("/");
          }
      });
    }
});

serv.listen(2000);
console.log('Server started.');

const SOCKET_LIST = {};
const player_list = {};

var Entity = function() {
    var self = {
        x: 250,
        y: 250,
        spdX: 0,
        spdY:0,
        id:"",
    }
    self.update = function() {
        self.updatePosition();
    }
    self.updatePosition = function() {
        self.x += self.spdX;
        self.y += self.spdY;
    }
    self.getDistance = function(pt) {
      return Math.sqrt(Math.pow(self.x-pt.x,2) + Math.pow(self.y-pt.y,2));
    }
    return self;
}
var Player = function(id) {
    var self = Entity();
    self.id = id;
    self.number = "" + Math.floor(10 * Math.random());
    self.pressingRight=false;
    self.pressingLeft=false;
    self.pressingUp=false;
    self.pressingDown=false;
    self.pressingAttack = false;
    self.mouseAngle = 0;
    self.maxSpd=10;
    self.hp = 10;
    self.maxHp = 10;
    self.score = 0;

    var super_update = self.update;
    self.update = function() {
        self.updateSpd();
        super_update();

        if (self.pressingAttack) {
            self.shootBullet(self.mouseAngle);
        }
    }
    self.shootBullet = function(angle) {
        var b = Bullet(self.id,angle);
        b.x = self.x;
        b.y = self.y;
    }

    self.updateSpd = function() {
        if(self.pressingRight){
            self.spdX = self.maxSpd;
        }
        else if (self.pressingLeft){
            self.spdX = -self.maxSpd;
        }
        else {
            self.spdX = 0;
        }
        if (self.pressingUp) {
            self.spdY = -self.maxSpd;
        }
        else if (self.pressingDown) {
            self.spdY = self.maxSpd;
        }
        else {
            self.spdY = 0;
        }
    }
    self.getInitPack = function() {
      return {
        id: self.id,
        x: self.x,
        y: self.y,
        number: self.number,
        hp: self.hp,
        maxHp: self.maxHp,
        score: self.score,
      };
    }
    self.getUpdatePack = function() {
      return {
        id: self.id,
        x: self.x,
        y: self.y,
        hp: self.hp,
        score: self.score,
      }
    }
    Player.list[id] = self;

    initPack.player.push(self.getInitPack());
    return self;
}
Player.list = {};
Player.onConnect = function(socket) {
    var player = Player(socket.id);
    socket.on('keyPress', function(data){
        if(data.inputId === 'left')
        player.pressingLeft = data.state;
        else if(data.inputId === 'right')
        player.pressingRight = data.state;
        else if(data.inputId === 'up')
        player.pressingUp = data.state;
        else if(data.inputId === 'down')
        player.pressingDown = data.state;
        else if (data.inputId === 'attack')
        player.pressingAttack = data.state;
        else if (data.inputId === 'mouseAngle')
        player.mouseAngle = data.state;
    });

    socket.emit('init',{
      player: Player.getAllInitPack(),
      bullet: Bullet.getAllInitPack(),
    });
}
Player.getAllInitPack = function() {
  var players = [];
  for (var i in Player.list){
    players.push(Player.list[i].getInitPack());
  }
  return players;
}
Player.onDisconnect = function (socket) {
    delete Player.list[socket.id];
    removePack.player.push(socket.id);
}
Player.update = function(){
    var pack = [];
    for (var i in Player.list) {
        var player = Player.list[i];
        player.update();
        pack.push(player.getUpdatePack());
    }
    return pack;
}
var Bullet = function(parent, angle) {
    var self = Entity();
    self.id = Math.random();
    self.spdX = Math.cos(angle/180*Math.PI) * 10;
    self.spdY = Math.sin(angle/180*Math.PI) * 10;
    self.timer = 0;
    self.parent = parent;
    self.toRemove = false;
    var super_update = self.update;
    self.update = function() {
        if (self.timer++ > 100)
            self.toRemove = true;
        super_update();

        for(var i in Player.list) {
          var p = Player.list[i];
          if(self.getDistance(p) < 25 && self.parent !== p.id){
            // handle collision
            p.hp -= 1;
            // if player 2 hp is lower than zero add 1 to player 1
            if(p.hp <= 0){
              var shooter = Player.list[self.parent];
                shooter.score += 1;
              p.hp = p.maxHp;
              p.x = Math.random()*500;
              p.y = Math.random()*500;
            }
            self.toRemove = true;
          }
        }
    }
    self.getInitPack = function() {
      return {
        id: self.id,
        x: self.x,
        y: self.y,
      };
    }
    self.getUpdatePack = function() {
      return {
          id:self.id,
          x: self.x,
          y: self.y,
      };
    }
    Bullet.list[self.id] = self;
    initPack.bullet.push(self.getInitPack());

    return self;
}

Bullet.list = {};

Bullet.update = function() {

    var pack = [];

    for (var i in Bullet.list) {
        var bullet = Bullet.list[i];
        bullet.update();
        if(bullet.toRemove){
            delete Bullet.list[i];
            removePack.bullet.push(bullet.id);
        } else{
            pack.push(bullet.getUpdatePack());
        }
    }
    return pack;
}

Bullet.getAllInitPack = function() {
  var bullets = [];
  for (var i in Bullet.list){
    bullets.push(Bullet.list[i].getInitPack());
  }
  return bullets;
}

var DEBUG = true;

// var USERS = {
//     //username:password
//     "bob":"asd",
//     "bob2":"bob",
//     "bob3":"ttt",
// }
var isValidPassword = function (data, cb) {
    db.account.find({username:data.username, password:data.password}, function(err, res){
        if(res.length > 0){
            cb(true);
        } else {
            cb(false);
        }
    });
}
var isUsernameTaken = function(data, cb) {
    db.account.find({ username: data.username}, function (err, res) {
        if (res.length > 0) {
            cb(true);
        } else {
            cb(false);
        }
    });
}
var addUser = function(data, cb) {
    db.account.insert({username:data.username,password: data.password}, function(err){
        cb();
    })
}

var io = require('socket.io').listen(serv);

io.sockets.on('connection', function(socket){
  socket.id = Math.random();
  SOCKET_LIST[socket.id] = socket;
  Player.onConnect(socket);


var DEBUG = true;

  socket.emit('signInResponse', { success: true });

  socket.on('sendMsgToServer', function(data){
      var playerID = ("" + socket.id).slice(2,7);
      for (var i in SOCKET_LIST){
          SOCKET_LIST[i].emit('addToChat', {userID: playerID, message: data});
      }
  });

    socket.on('disconnect', function(){
        delete SOCKET_LIST[socket.id];
        Player.onDisconnect(socket);
    });

    socket.on('evalServer', function (data) {
        var res = eval(data);
        socket.emit('evalAnswer', res);
    });

});

var initPack = { player: [], bullet: [] };
var removePack = { player: [], bullet: [] };

setInterval(function(){
    var pack = {
        player:Player.update(),
        bullet:Bullet.update(),
    }

    for (var i in SOCKET_LIST){
        var socket = SOCKET_LIST[i];
        socket.emit('init', initPack);
        socket.emit('update', pack);
        socket.emit('remove', removePack);
    }
    initPack.player = [];
    initPack.bullet = [];
    removePack.player = [];
    removePack.bullet = [];

}, 1000/25);
