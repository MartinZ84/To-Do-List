const jwt = require("jsonwebtoken");
const bcrypt = require("bcrypt");
// const conexion = require("../database/db");
const { promisify } = require("util");

const Item = require("../models").Item;
const Lista = require("../models").List;
const User = require("../models").User;

//procedimiento para registrarnos
exports.register = async function (req, res) {
  try {
    const name = req.body.name;
    const apellido = req.body.apellido;
    const email = req.body.email;
    const pass = req.body.password;
    // Creando un nuevo usuario
    const user = await User.create({
      nombre: name,
      apellido: apellido,
      email: email,
      pass: pass,
    });
    // generar salt para hashear el password
    const salt = await bcrypt.genSalt(10);
    // hasheamos el password con salt anexado
    let passHash = await bcrypt.hash(pass, salt);
    console.log(passHash);
    console.log(req.body);

    user.pass = passHash;
    await user.save();
    res.redirect("/");
  } catch (error) {
    console.log(error);
  }
};

exports.login = async function (req, res) {
  try {
    console.log("entrto hasta el pricipio de login dentro de try");
    const user = req.body.user;
    const pass = req.body.password;
    const email = req.body.email;
    console.log(email + " " + pass);
    if (!email || !pass) {
      console.log("entrto hasta el pricipio de login dentro de try > if");
      res.render("login", {
        pretty: true,
        alert: true,
        alertTitle: "Advertencia",
        alertMessage: "Ingrese un usuario y password",
        alertIcon: "info",
        showConfirmButton: true,
        timer: false,
        ruta: "login",
      });
    } else {
      console.log("linea 59");
      const user = await User.findAll({ where: { email: email } });
      // console.log(user[0].email);
      console.log("linea 62");
      if (!user[0] || !(await bcrypt.compare(pass, user[0].pass))) {
        console.log("inicio de sesión mal");
        res.render("login", {
          pretty: true,
          alert: true,
          alertTitle: "Error",
          alertMessage: "Usuario y/o Password incorrectas",
          alertIcon: "error",
          showConfirmButton: true,
          timer: 2500,
          ruta: "login",
        });
      } else {
        //inicio de sesión OK
        console.log("inicio de sesión OK");
        const id = user[0].id;
        const rol = user[0].rol;
        const token = jwt.sign({ id: id, rol: rol }, process.env.JWT_SECRETO, {
          expiresIn: process.env.JWT_TIEMPO_EXPIRA,
        });
        //generamos el token SIN fecha de expiracion
        //const token = jwt.sign({id: id}, process.env.JWT_SECRETO)
        console.log(
          "TOKEN: " +
            token +
            " para el USUARIO : " +
            user[0].nombre +
            ", rol" +
            user[0].rol
        );

        const cookiesOptions = {
          expires: new Date(
            Date.now() + process.env.JWT_COOKIE_EXPIRES * 24 * 60 * 60 * 1000
          ),
          httpOnly: true,
        };
        res.cookie("jwt", token, cookiesOptions);
        res.render("login", {
          pretty: true,
          alert: true,
          alertTitle: "Conexión exitosa",
          alertMessage: "¡LOGIN CORRECTO!",
          alertIcon: "success",
          showConfirmButton: false,
          timer: 2500,
          ruta: "",
          user: user[0],
        });
      }
      //   }
      // );
    }
  } catch (error) {
    console.log("catch error: " + error);
  }
};

exports.isAuthenticated = async (req, res, next) => {
  if (req.cookies.jwt) {
    try {
      console.log("Estamos aca isAuthenticated  dentro del try");
      const decodificada = await promisify(jwt.verify)(
        req.cookies.jwt,
        process.env.JWT_SECRETO
      );
      console.log(decodificada);
      let user = await User.findByPk(decodificada.id);
      // ({ where: { id: decodificada.id } });
      console.log(user);
      if (!user) {
        return next();
      }
      req.user = user;
      console.log(req.user);
      return next();
    } catch (error) {
      console.log(error);
      // return next();
      res.redirect("/login");
    }
  } else if (req.user) {
    console.log("dentro de else if authecticated  " + req.user);
    return next();
  } else {
    console.log("en el else del isAuthenticated login ");
    res.redirect("/login");
    // return next()
  }
};

exports.isAuthorizated = (roles) => async (req, res, next) => {
  console.log(req.cookies);
  console.log(Object.keys(req.cookies).includes("connect.sid"));
  if (req.cookies.jwt) {
    try {
      console.log("Estamos aca iautorizacion  dentro del try");
      const decodificada = await promisify(jwt.verify)(
        req.cookies.jwt,
        process.env.JWT_SECRETO
      );
      console.log(decodificada);
      let user = await User.findByPk(decodificada.id);

      console.log(user);
      if (!user) {
        return next();
      }

      if ([].concat(roles).includes(user.rol)) {
        next();
      } else {
        res.render("401", { user: req.user });
        // res.status(401);
        // res.send({ error: "NO TIENE PERMISOS PARA VER EL RECURSO" });
      }

      // req.user = user;
      // console.log(req.user);
      // return next();
    } catch (error) {
      console.log(error);
      return next();
    }
  } else if (Object.keys(req.cookies).includes("connect.sid")) {
    try {
      console.log("roooooooooooolllllllllll" + req.user[0].rol);
      if (req.user[0].rol === "Admin") next();
      else {
        res.render("401", { user: req.user[0] });
      }
    } catch (error) {
      console.log(error);
      return next();
    }
  } else {
    res.redirect("/login");
  }
};

exports.logout = (req, res, next) => {
  res.clearCookie("jwt");

  //para github
  req.session.destroy();
  req.logout();
  return res.redirect("/");
};
