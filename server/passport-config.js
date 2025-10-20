const passport = require("passport");
const LocalStrategy = require("passport-local").Strategy;
const { User } = require("./models");

passport.use(
  new LocalStrategy(
    {
      usernameField: "username", // or 'email' if you log in by email
      passwordField: "password",
    },
    async (username, password, done) => {
      try {
        // Sequelize uses 'where' for queries
        const user = await User.findOne({ where: { username } });

        if (!user) {
          return done(null, false, { message: "Incorrect username." });
        }

        // You might need to replace this depending on how passwords are stored
        const isValid = await user.validPassword(password);
        if (!isValid) {
          return done(null, false, { message: "Incorrect password." });
        }

        return done(null, user);
      } catch (err) {
        return done(err);
      }
    }
  )
);

passport.serializeUser((user, done) => {
  done(null, user.id);
});

passport.deserializeUser(async (id, done) => {
  try {
    // Sequelize uses findByPk instead of findById
    const user = await User.findByPk(id);
    done(null, user);
  } catch (err) {
    done(err);
  }
});

module.exports = passport;

