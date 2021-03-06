
var mongojs = require('mongojs');
var db = mongojs('localhost:27017/myGame', ['account', 'progress']);
const express = require('express');
const path = require('path');
var app = express();
var session = require('express-session');
var connect = require('connect');
var sessionStore = new express.session.MemoryStore({ reapInterval: 60000 * 10 });
var cookie = require('cookie');
var cookieParser = require('cookie-parser');
var bodyParser = require('body-parser');
var serv = require('http').Server(app);
var pug = require('pug');

  // Configuration
app.use('/client/public',express.static(__dirname + '/client/public'));
app.set('view engine','pug');
app.set('views', __dirname + '/client/views');

app.use(express.cookieParser('123456789SECRET'));

  // Session management
app.use(session({

    secret:'123456789SECRET',
    saveUninitialized : false,
    resave: false,
    store: sessionStore
}));
// Allow parsing form data
var username;
app.use(bodyParser());
function requireLogin(req, res, next) {
  // recupère l'identifiant de session
  if (req.session.username) {
    username = req.session.username;
    // console.log(req.session);
    next();
  } else {
  res.redirect('/login');
  }
}
app.get('/', [requireLogin], function (req, res, next) {
  var date = new Date(Date.UTC(2018,4,21,3,4,5));
  res.cookie('username', req.session.username);
  res.render('index', {"username": req.session.username, "date": date});
});

app.get("/login", function (req, res) {

  res.render("login", { "username": req.session.username, "error": null });
});

app.post("/login", function (req, res) {

  var options = { "username": req.body.username, "error": null };
  if (!req.body.username) {
    options.error = "User name is required";
    res.render("login", options);
  } else if (req.body.username == req.session.username) {

    res.redirect('/');
  } else if (!req.body.username.match(/^\w{3,}$/)) {
    options.error = "User name must have at least 3 alphanumeric characters";
    res.render("login", options);
  } else
  if(!req.body.password){
    options.error = "Password is required";
    res.render("login", options);
  } else {
    // check if username is taken
    db.account.find({ username: req.body.username}, function(err, data) {
        if (data.length > 0) {
          var password = req.body.password;

            var isPasswordValid = function (psw, cb) {
                db.account.find({username: req.body.username, password: psw}, function(err, data){
                    if(data.length > 0){
                        // true
                        console.log('password match');
                        cb(true);
                    } else {
                        // false
                        console.log("password doesn't match");
                        cb(false);
                    }
                });
            };
            isPasswordValid(password, function(rep){
              if(rep){
                var sessionID = req.sessionID;
                req.session.username = req.body.username;
                options.error = "sign In successfull";
                res.redirect("/");

              } else {
                options.error = "User name is already taken. Wrong login or password";
                res.render("login", options);

              }
            });

        } else {
            // false
            req.session.username = req.body.username;
            db.account.insert({username: req.session.username, password: req.body.password})
            options.error = "sign up successfull";
            res.redirect("/");
        }
    });
  }
});
var connections = {};

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
    self.letter = getUniqueLetter();
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
        letter: self.letter,
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
  var playerID = Player.list[socket.id].id;
  var playerLetter = Player.list[socket.id].letter;
  var scorePlayer = Player.list[socket.id].score;
  db.progress.find({ userLetter: playerLetter }, function(err, data){
    if(data.length>0){
        // update player score
        db.progress.update({userLetter: playerLetter, score: scorePlayer});
      } else {
        // insert player score
        db.progress.insert({userLetter: playerLetter, score: scorePlayer});
      }
  });
  // db.progress.insert({userID: playerID, score: score});
  //db.progress.update({userID: playerID, score: score});

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
            // if player2 hp <= O player1 score +1
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

var getUniqueLetter = function() {
    return String.fromCharCode(Math.floor(Math.random() * (90 - 65) + 65));
}
var connections = {};
var io = require('socket.io').listen(serv);

io.sockets.on('connection', function(socket){
  // Read cookies
  // console.log(JSON.stringify(socket.handshake.headers.cookie));
  var cookies = cookie.parse(socket.handshake.headers.cookie);
  var sessionID = connect.utils.parseSignedCookie(cookies['connect.sid'], '123456789SECRET');
  socket.handshake.sessionID = sessionID;
  // var sessionID = s.splice(2); // Store session ID from handshake
  // this is required if we want to access this data when user leaves, as handshake is
  // not available in "disconnect" event.
  // socket.handshake.username = username; // Same here, to allow event "bye" with username
  var username = "";
  sessionStore.get(sessionID, function (err, session) {
    if(!err && session){
      username = session.username;
      socket.handshake.username = session.username;
    } else
    console.log(err);
  });
  console.log(socket.handshake);
  var username = connect.utils.parseSignedCookie(cookies['username'], '123456789SECRET');
  console.log(username);
  var date = new Date();
  socket.id = Math.random();
  SOCKET_LIST[socket.id] = socket;
  Player.onConnect(socket);
  for (var i in SOCKET_LIST){
      SOCKET_LIST[i].emit('join', {'username': username, date: date});
  }
  // socket.emit('join', {"username" : username, "date" : Date.now()});

  // if (connections[sessionID] == undefined) {
  //   connections[sessionID] = { "length": 0 };
  //   connections[sessionID][socket.id] = socket;
  // }
  // connections[sessionID][socket.id] = socket;
  // // First connection
  // connections[sessionID].length++;
  // Add connection to pool
  // {sessionID : {socket.id : { socket }} }


var DEBUG = true;

  //     var playerID = ("" + socket.id).slice(2,7);
  //     var score = db.progress.find({userID: playerID});
  //     socket.emit('addToPlayerList', {userID: playerID, score: score});

  socket.on('sendMsgToServer', function(data){
      var playerID = ("" + socket.id).slice(2,7);
      var username = socket.handshake.username;
      for (var i in SOCKET_LIST){
          SOCKET_LIST[i].emit('addToChat', {'username': username, message: data});
      }
  });

    socket.on('disconnect', function(){
        // Is this socket associated to user session ?
        // var userConnections = connections[sessionID];
        // if (userConnections.length && userConnections[socket.id]) {
        //   // Forget this socket
        //   userConnections.length --;
        //   delete userConnections[socket.id];
        // }
        // if (userConnections.length == 0) {
          // No more active sockets for this user: say bye
          // socket.emit('bye', user, Date.now());
          delete SOCKET_LIST[socket.id];
          Player.onDisconnect(socket);
        // }

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
