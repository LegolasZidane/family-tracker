import express from "express";
import bodyParser from "body-parser";
import pg from "pg";
import { parse } from "pg-connection-string";

const app = express();
const port = process.env.PORT || 3000;
const {Client} = pg;

const config = parse(process.env.DATABASE_URL);
config.ssl = { rejectUnauthorized: false };
const db = new Client(config);
db.connect()
  .then(() => console.log("Connected to Supabase"))
  .catch(err => console.error("Connection error", err));

app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.static("public"));

let currentUserId = 0;

let users = [];

async function checkVisisted() {
  try {

    const result = await db.query("SELECT country_code FROM visited_countries WHERE user_id = $1", [currentUserId]);
    let countries = [];
    result.rows.forEach((country) => {
      countries.push(country.country_code);
    });

    return countries;

  } catch (err) {

    console.log(err);

  }
}


app.get("/", async (req, res) => {
  try{

    const result = await db.query("SELECT id, name, color FROM users;");
    
    if( result.rows.length !== 0 ){

      users = result.rows;
      const countries = await checkVisisted();

      res.render("index.ejs", { 
        countries: countries,
        total: countries.length,
        users: users,
        color: users[currentUserId].color
      });

    } else
      res.render("index.ejs");

  } catch(err) {

    console.log(err);
  
  }
});


app.post("/add", async (req, res) => {

  const input = req.body["country"];

  try {

    const result = await db.query(
      "SELECT country_code FROM countries WHERE LOWER(country_name) LIKE $1 || '%';",
      [input.toLowerCase()]
    );

    if( users.length === 0 )
      res.render("index.ejs", {error: "First create a user, then add countries to it"});
    else {
      const data = result.rows[0];
      const countryCode = data.country_code;
      
      try {
      
        await db.query(
          "INSERT INTO visited_countries (country_code, user_id) VALUES ($1, $2)",
          [countryCode, currentUserId]
        );
      
        res.redirect("/");
      
      } catch (err) {
      
        const countries = await checkVisisted();
      
        res.render("index.ejs", {
          total: countries.length,
          countries: countries,
          error: "Country already exists, try again.",
          users: users,
          color: users[currentUserId].color
        });
      }
    }
  } catch (err) {
    
    const countries = await checkVisisted();
    
    res.render("index.ejs", {
        total: countries.length,
        countries: countries,
        error: "Did not match with saved countries, try again.",
        users: users,
        color: users[currentUserId].color
      });
  
  }
});


app.post("/user", async (req, res) => {

  if( req.body.add )
    res.render("new.ejs");
  else {

    currentUserId = req.body.user;
    res.redirect("/");

  }
});

app.post("/new", async (req, res) => {

  const newUser = {
    id: users.length,
    name: req.body.name,
    color: req.body.color || 'white'
  };
  
  await db.query("INSERT INTO users (id, name, color) VALUES ($1, $2, $3)", [newUser.id, newUser.name, newUser.color]);
  users.push(newUser);

  currentUserId = newUser.id;

  res.redirect("/");
});

app.listen(port, "0.0.0.0",() => {

  console.log(`Server running on http://0.0.0.0:${port}`);

});
