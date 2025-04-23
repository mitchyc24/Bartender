const express = require('express');
const cors = require('cors');
const { Pool } = require('pg');
require('dotenv').config();

const app = express();
const port = process.env.PORT || 3001; // Use environment variable or default

// --- Database Configuration ---
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  // Add SSL configuration if required for your database provider (e.g., Heroku, AWS)
  // ssl: {
  //   rejectUnauthorized: false // Adjust based on your provider's requirements
  // }
});

// --- Middleware ---
app.use(cors()); // Enable CORS for all origins (adjust for production)
app.use(express.json()); // Parse JSON request bodies

// --- API Routes ---

// Test Route
app.get('/', (req, res) => {
  res.send('Bartender Server is running!');
});

// == Ingredients ==
// GET all ingredients
app.get('/api/ingredients', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM ingredients ORDER BY name ASC');
    res.json(result.rows);
  } catch (err) {
    console.error('Error fetching ingredients:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST a new ingredient
app.post('/api/ingredients', async (req, res) => {
  const { name } = req.body;
  if (!name || typeof name !== 'string' || name.trim() === '') {
    return res.status(400).json({ error: 'Ingredient name is required.' });
  }
  try {
    // Basic check for duplicates (case-insensitive)
    const check = await pool.query('SELECT id FROM ingredients WHERE LOWER(name) = LOWER($1)', [name.trim()]);
    if (check.rows.length > 0) {
      return res.status(409).json({ error: 'Ingredient already exists.' });
    }
    const result = await pool.query(
      'INSERT INTO ingredients (name) VALUES ($1) RETURNING *',
      [name.trim()]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error('Error adding ingredient:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// DELETE an ingredient
app.delete('/api/ingredients/:id', async (req, res) => {
  const { id } = req.params;
   if (!/^\d+$/.test(id)) { // Basic check if ID is numeric
     return res.status(400).json({ error: 'Invalid ingredient ID format.' });
   }
  try {
    const result = await pool.query('DELETE FROM ingredients WHERE id = $1 RETURNING *', [id]);
    if (result.rowCount === 0) {
      return res.status(404).json({ error: 'Ingredient not found.' });
    }
    res.status(200).json({ message: 'Ingredient deleted successfully', deletedIngredient: result.rows[0] }); // Or just 204 No Content
  } catch (err) {
    console.error('Error deleting ingredient:', err);
    // Check for foreign key constraint errors if ingredients are linked elsewhere
    if (err.code === '23503') { // PostgreSQL foreign key violation error code
        return res.status(409).json({ error: 'Cannot delete ingredient as it is used in recipes.' });
    }
    res.status(500).json({ error: 'Internal server error' });
  }
});


// == Recipes == (Custom Recipes Only for now)
// GET all custom recipes
app.get('/api/recipes', async (req, res) => {
    try {
        // Fetch recipes and their ingredients using JOINs or separate queries
        // This example uses separate queries for simplicity, but JOINs can be more efficient

        const recipesResult = await pool.query('SELECT * FROM recipes WHERE is_custom = TRUE ORDER BY name ASC');
        const recipes = recipesResult.rows;

        // Fetch ingredients for each recipe
        for (const recipe of recipes) {
            const ingredientsResult = await pool.query(
                'SELECT name, quantity, unit FROM recipe_ingredients WHERE recipe_id = $1',
                [recipe.id]
            );
            recipe.ingredients = ingredientsResult.rows; // Add ingredients array to each recipe object
        }

        res.json(recipes);
    } catch (err) {
        console.error('Error fetching recipes:', err);
        res.status(500).json({ error: 'Internal server error' });
    }
});


// POST a new custom recipe
app.post('/api/recipes', async (req, res) => {
    const { name, instructions, ingredients } = req.body;

    // Basic Validation
    if (!name || !instructions || !Array.isArray(ingredients)) {
        return res.status(400).json({ error: 'Missing required recipe fields (name, instructions, ingredients array).' });
    }
    if (ingredients.some(ing => !ing.name || !ing.quantity)) {
         return res.status(400).json({ error: 'Each ingredient must have a name and quantity.' });
    }

    const client = await pool.connect(); // Use a transaction

    try {
        await client.query('BEGIN');

        // Insert the recipe
        const recipeResult = await client.query(
            'INSERT INTO recipes (name, instructions, is_custom) VALUES ($1, $2, TRUE) RETURNING *',
            [name.trim(), instructions.trim()]
        );
        const newRecipe = recipeResult.rows[0];

        // Insert the recipe ingredients
        // Consider creating missing base ingredients on the fly or validating against existing ones
        for (const ing of ingredients) {
            // Optional: Find or create the base ingredient ID if your schema links recipe_ingredients to an ingredients table ID
            // For this example, we store names directly in recipe_ingredients
            await client.query(
                'INSERT INTO recipe_ingredients (recipe_id, name, quantity, unit) VALUES ($1, $2, $3, $4)',
                [newRecipe.id, ing.name.trim(), ing.quantity.trim(), ing.unit?.trim() || ''] // Handle potentially missing unit
            );
        }

        await client.query('COMMIT');

        // Refetch the complete recipe with ingredients to return
        newRecipe.ingredients = ingredients.map(ing => ({
            name: ing.name.trim(),
            quantity: ing.quantity.trim(),
            unit: ing.unit?.trim() || ''
        })); // Add ingredients back for the response

        res.status(201).json(newRecipe);

    } catch (err) {
        await client.query('ROLLBACK');
        console.error('Error adding recipe:', err);
        res.status(500).json({ error: 'Internal server error while adding recipe.' });
    } finally {
        client.release();
    }
});

// DELETE a custom recipe
app.delete('/api/recipes/:id', async (req, res) => {
    const { id } = req.params;
     if (!/^\d+$/.test(id)) {
        return res.status(400).json({ error: 'Invalid recipe ID format.' });
     }

    const client = await pool.connect(); // Use a transaction

    try {
        await client.query('BEGIN');

        // Check if it's a custom recipe before deleting
        const checkResult = await client.query('SELECT is_custom FROM recipes WHERE id = $1', [id]);
        if (checkResult.rowCount === 0) {
             await client.query('ROLLBACK'); // No need to proceed
             return res.status(404).json({ error: 'Recipe not found.' });
        }
        if (!checkResult.rows[0].is_custom) {
            await client.query('ROLLBACK'); // No need to proceed
            return res.status(403).json({ error: 'Cannot delete standard recipes.' });
        }

        // Delete associated recipe ingredients first (due to foreign key constraints)
        await client.query('DELETE FROM recipe_ingredients WHERE recipe_id = $1', [id]);

        // Delete the recipe itself
        const deleteRecipeResult = await client.query('DELETE FROM recipes WHERE id = $1 RETURNING *', [id]);

        // Check if the recipe was actually deleted (it should be, after the check above)
        if (deleteRecipeResult.rowCount === 0) {
             await client.query('ROLLBACK'); // Should not happen if check passed, but good practice
             return res.status(404).json({ error: 'Recipe not found during deletion.' });
        }


        await client.query('COMMIT');
        res.status(200).json({ message: 'Custom recipe deleted successfully', deletedRecipe: deleteRecipeResult.rows[0] }); // Or 204

    } catch (err) {
        await client.query('ROLLBACK');
        console.error('Error deleting recipe:', err);
        res.status(500).json({ error: 'Internal server error while deleting recipe.' });
    } finally {
        client.release();
    }
});


// --- Database Initialization ---
const initializeDb = async () => {
  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS ingredients (
        id SERIAL PRIMARY KEY,
        name VARCHAR(255) UNIQUE NOT NULL
      );
    `);
    console.log('Table "ingredients" checked/created.');

    await pool.query(`
      CREATE TABLE IF NOT EXISTS recipes (
        id SERIAL PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        instructions TEXT,
        is_custom BOOLEAN DEFAULT TRUE NOT NULL -- Flag for standard vs user recipes
      );
    `);
     console.log('Table "recipes" checked/created.');

    await pool.query(`
      CREATE TABLE IF NOT EXISTS recipe_ingredients (
        id SERIAL PRIMARY KEY,
        recipe_id INTEGER REFERENCES recipes(id) ON DELETE CASCADE, -- Delete ingredients if recipe is deleted
        name VARCHAR(255) NOT NULL, -- Storing name directly for simplicity
        -- Alternatively, reference ingredients table: ingredient_id INTEGER REFERENCES ingredients(id),
        quantity VARCHAR(50) NOT NULL,
        unit VARCHAR(50)
      );
    `);
    console.log('Table "recipe_ingredients" checked/created.');

    // Optional: Add indexes for performance
    await pool.query('CREATE INDEX IF NOT EXISTS idx_recipe_ingredients_recipe_id ON recipe_ingredients(recipe_id);');
    // await pool.query('CREATE INDEX IF NOT EXISTS idx_ingredients_name ON ingredients(lower(name));'); // For case-insensitive lookups
    console.log('Database indexes checked/created.');

    // Optional: Seed standard recipes if they don't exist
    // This requires careful handling to avoid duplicates on restart
    // See seedStandardRecipes function below for a possible implementation

  } catch (err) {
    console.error('Error initializing database:', err);
    process.exit(1); // Exit if DB init fails
  }
};


// --- Start Server ---
const startServer = async () => {
  await initializeDb();
  // await seedStandardRecipes(); // Call seeding function if needed

  app.listen(port, () => {
    console.log(`Server listening on port ${port}`);
  });
};

startServer();

// --- Optional: Seeding Standard Recipes ---
// Add logic here if you want the server to ensure standard recipes exist in the DB
// Example (needs refinement for robust duplicate checking):
/*
const STANDARD_RECIPES_DATA = [
  {
    id_in_code: "1", // Keep track if needed, DB ID will be different
    name: "Margarita",
    isCustom: false,
    ingredients: [
      { name: "Tequila", quantity: "2", unit: "oz" },
      { name: "Lime Juice", quantity: "1", unit: "oz" },
      { name: "Triple Sec", quantity: "1", unit: "oz" },
    ],
    instructions: "Shake with ice and strain into a salt-rimmed glass.",
  },
   {
    id_in_code: "2",
    name: "Old Fashioned",
    isCustom: false,
    ingredients: [
      { name: "Bourbon", quantity: "2", unit: "oz" },
      { name: "Simple Syrup", quantity: "0.5", unit: "oz" },
      { name: "Angostura Bitters", quantity: "2", unit: "dashes" },
    ],
    instructions: "Stir with ice and strain into a rocks glass.",
  },
];

const seedStandardRecipes = async () => {
    const client = await pool.connect();
    try {
        console.log('Seeding standard recipes...');
        for (const stdRecipe of STANDARD_RECIPES_DATA) {
            // Check if recipe already exists (by name and is_custom flag)
            const check = await client.query(
                'SELECT id FROM recipes WHERE name = $1 AND is_custom = FALSE',
                [stdRecipe.name]
            );

            if (check.rows.length === 0) {
                console.log(`Adding standard recipe: ${stdRecipe.name}`);
                await client.query('BEGIN');
                const recipeResult = await client.query(
                    'INSERT INTO recipes (name, instructions, is_custom) VALUES ($1, $2, FALSE) RETURNING id',
                    [stdRecipe.name, stdRecipe.instructions]
                );
                const newRecipeId = recipeResult.rows[0].id;

                for (const ing of stdRecipe.ingredients) {
                     // Optional: Ensure base ingredient exists in 'ingredients' table first if using ingredient_id FK
                    await client.query(
                        'INSERT INTO recipe_ingredients (recipe_id, name, quantity, unit) VALUES ($1, $2, $3, $4)',
                        [newRecipeId, ing.name, ing.quantity, ing.unit]
                    );
                }
                 await client.query('COMMIT');
            } else {
                 console.log(`Standard recipe "${stdRecipe.name}" already exists.`);
            }
        }
        console.log('Standard recipe seeding complete.');
    } catch (err) {
        await client.query('ROLLBACK');
        console.error('Error seeding standard recipes:', err);
    } finally {
        client.release();
    }
};
*/
