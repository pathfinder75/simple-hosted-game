function logMeIn() {
  // sign
  var signDiv = document.getElementById('signDiv');
  var signDivUsername = document.getElementById('signDiv-username');
  var signDivSignIn = document.getElementById('signDiv-signIn');
  var signDivSignUp = document.getElementById('signDiv-signUp');
  var signDivPassword =   document.getElementById('signDiv-password');

  signDivSignIn.onclick = function() {
    console.log('signed in!')
    socket.emit('signIn',{username:signDivUsername.value, password:signDivPassword.value});
  }
}
