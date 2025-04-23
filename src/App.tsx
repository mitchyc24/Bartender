import React, {
  useState,
  useMemo,
  useCallback,
  useReducer,
  useEffect,
  createContext,
  useContext,
} from "react";
import {
  Container,
  Row,
  Col,
  Card,
  Form,
  Button,
  Badge,
  InputGroup,
  Tabs,
  Tab,
  ListGroup,
  Stack,
  Navbar,
} from "react-bootstrap";
import "bootstrap/dist/css/bootstrap.min.css";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faPlus,
  faTrash,
  faSearch,
  faSave,
  faCocktail,
  faWhiskeyGlass,
  faWarehouse,
  faListAlt,
  faTools,
  faPlusCircle,
  faCopy,
  faEraser,
  faSun,
  faMoon,
  faSpinner,
} from "@fortawesome/free-solid-svg-icons";

// --- Configuration ---
const API_BASE_URL = "/api"; // Use relative path

// Types
type Ingredient = { id: number; name: string };
type RecipeIngredient = { name: string; quantity: string; unit: string };
type Recipe = {
  id: number;
  name: string;
  ingredients: RecipeIngredient[];
  instructions: string;
};

// State management
type State = {
  ingredients: Ingredient[];
  recipes: Recipe[];
  loading: boolean;
  error: string | null;
};
type Action =
  | { type: "SET_LOADING"; payload: boolean }
  | { type: "SET_ERROR"; payload: string | null }
  | { type: "SET_INGREDIENTS"; payload: Ingredient[] }
  | { type: "ADD_INGREDIENT"; payload: Ingredient }
  | { type: "REMOVE_INGREDIENT"; payload: number }
  | { type: "SET_RECIPES"; payload: Recipe[] }
  | { type: "ADD_RECIPE"; payload: Recipe }
  | { type: "REMOVE_RECIPE"; payload: number };

const initialState: State = {
  ingredients: [],
  recipes: [],
  loading: true,
  error: null,
};
const AppContext = createContext<{
  state: State;
  dispatch: React.Dispatch<Action>;
}>({ state: initialState, dispatch: () => null });

const reducer = (state: State, action: Action): State => {
  switch (action.type) {
    case "SET_LOADING":
      return { ...state, loading: action.payload };
    case "SET_ERROR":
      return { ...state, error: action.payload, loading: false };
    case "SET_INGREDIENTS":
      return { ...state, ingredients: action.payload, loading: false };
    case "ADD_INGREDIENT":
      if (state.ingredients.some((i) => i.id === action.payload.id)) {
        return state;
      }
      return { ...state, ingredients: [...state.ingredients, action.payload] };
    case "REMOVE_INGREDIENT":
      return {
        ...state,
        ingredients: state.ingredients.filter((i) => i.id !== action.payload),
      };
    case "SET_RECIPES":
      return { ...state, recipes: action.payload, loading: false };
    case "ADD_RECIPE":
      if (state.recipes.some((r) => r.id === action.payload.id)) {
        return state;
      }
      return {
        ...state,
        recipes: [...state.recipes, action.payload],
      };
    case "REMOVE_RECIPE":
      return {
        ...state,
        recipes: state.recipes.filter((r) => r.id !== action.payload),
      };
    default:
      return state;
  }
};

const useRecipeFilter = (
  recipes: Recipe[],
  ingredients: Ingredient[],
  search: string,
  showMakeable: boolean
) => {
  const canMakeRecipe = useCallback(
    (recipe: Recipe) => {
      const ingredientNames = ingredients.map((i) => i.name.toLowerCase());
      return recipe.ingredients.every((ri) =>
        ingredientNames.includes(ri.name.toLowerCase())
      );
    },
    [ingredients]
  );

  return useMemo(() => {
    let filtered = recipes;
    if (search) {
      filtered = filtered.filter((r) =>
        r.name.toLowerCase().includes(search.toLowerCase())
      );
    }
    if (showMakeable) {
      filtered = filtered.filter(canMakeRecipe);
    }
    return filtered;
  }, [recipes, search, showMakeable, canMakeRecipe]);
};

// Components
const IngredientManager: React.FC = () => {
  const { state, dispatch } = useContext(AppContext);
  const [newIngredient, setNewIngredient] = useState("");
  const [isAdding, setIsAdding] = useState(false);

  const addIngredient = async (nameToAdd?: string) => {
    const ingredientName = (nameToAdd || newIngredient).trim();
    if (!ingredientName) return;

    if (
      state.ingredients.some(
        (i) => i.name.toLowerCase() === ingredientName.toLowerCase()
      )
    ) {
      console.warn("Ingredient likely already exists.");
      if (!nameToAdd) setNewIngredient("");
      return;
    }

    setIsAdding(true);
    try {
      const response = await fetch(`${API_BASE_URL}/ingredients`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: ingredientName }),
      });
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(
          errorData.error || `Failed to add ingredient: ${response.statusText}`
        );
      }
      const addedIngredient: Ingredient = await response.json();
      dispatch({ type: "ADD_INGREDIENT", payload: addedIngredient });
      if (!nameToAdd) {
        setNewIngredient("");
      }
    } catch (error: any) {
      console.error("Error adding ingredient:", error);
      alert(`Error: ${error.message}`);
    } finally {
      setIsAdding(false);
    }
  };

  const removeIngredient = async (id: number) => {
    try {
      const response = await fetch(`${API_BASE_URL}/ingredients/${id}`, {
        method: "DELETE",
      });
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(
          errorData.error ||
            `Failed to delete ingredient: ${response.statusText}`
        );
      }
      dispatch({ type: "REMOVE_INGREDIENT", payload: id });
    } catch (error: any) {
      console.error("Error deleting ingredient:", error);
      alert(`Error: ${error.message}`);
    }
  };

  const quickAddIngredient = (name: string) => {
    addIngredient(name);
  };

  const availableSuggestions = useMemo(() => {
    const allRecipes = state.recipes;
    const allRecipeIngredientNames = new Set<string>();
    allRecipes.forEach((recipe) => {
      recipe.ingredients.forEach((ing) => {
        const normalizedName = ing.name
          .trim()
          .split(" ")
          .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
          .join(" ");
        if (normalizedName) {
          allRecipeIngredientNames.add(normalizedName);
        }
      });
    });

    const currentIngredientNames = new Set(
      state.ingredients.map((i) => i.name.toLowerCase())
    );

    const suggestions = Array.from(allRecipeIngredientNames).filter(
      (suggestion) => !currentIngredientNames.has(suggestion.toLowerCase())
    );

    suggestions.sort((a, b) => a.localeCompare(b));

    return suggestions;
  }, [state.ingredients, state.recipes]);

  return (
    <Card className="mb-4">
      <Card.Body>
        <Card.Title>
          <FontAwesomeIcon icon={faListAlt} className="me-2" />
          My Ingredients
        </Card.Title>
        <InputGroup className="mb-3">
          <Form.Control
            value={newIngredient}
            onChange={(e) => setNewIngredient(e.target.value)}
            placeholder="Add new ingredient"
            onKeyPress={(e) => e.key === "Enter" && addIngredient()}
            disabled={isAdding}
          />
          <Button onClick={() => addIngredient()} disabled={isAdding}>
            <FontAwesomeIcon
              icon={isAdding ? faSpinner : faPlus}
              spin={isAdding}
              className="me-1"
            />{" "}
            Add
          </Button>
        </InputGroup>

        <div className="d-flex flex-wrap gap-2 mb-3">
          {state.ingredients.length > 0 ? (
            state.ingredients.map((ingredient) => (
              <Badge
                key={ingredient.id}
                pill
                bg="secondary"
                className="d-flex align-items-center p-2"
              >
                <span className="me-2">{ingredient.name}</span>
                <Button
                  variant="outline-danger"
                  size="sm"
                  className="border-0 p-0"
                  style={{ lineHeight: 1 }}
                  onClick={() => removeIngredient(ingredient.id)}
                >
                  <FontAwesomeIcon icon={faTrash} size="xs" />
                </Button>
              </Badge>
            ))
          ) : (
            <small className="text-muted">No ingredients added yet.</small>
          )}
        </div>

        <div className="mb-3">
          <h6>Quick Select (Based on Recipes)</h6>
          <div style={{ maxHeight: "150px", overflowY: "auto" }}>
            {availableSuggestions.length > 0 ? (
              availableSuggestions.map((suggestion) => (
                <Button
                  key={suggestion}
                  variant="outline-secondary"
                  size="sm"
                  className="me-1 mb-1"
                  onClick={() => quickAddIngredient(suggestion)}
                >
                  <FontAwesomeIcon icon={faPlusCircle} className="me-1" />
                  {suggestion}
                </Button>
              ))
            ) : (
              <small className="text-muted">
                All recipe ingredients added or no recipes available.
              </small>
            )}
          </div>
        </div>
      </Card.Body>
    </Card>
  );
};

interface RecipeCreatorProps {
  initialData?: Recipe | null;
  onClear?: () => void;
}

const RecipeCreator: React.FC<RecipeCreatorProps> = ({
  initialData,
  onClear,
}) => {
  const { dispatch } = useContext(AppContext);
  const [name, setName] = useState("");
  const [instructions, setInstructions] = useState("");
  const [ingredients, setIngredients] = useState<RecipeIngredient[]>([
    { name: "", quantity: "", unit: "" },
  ]);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (initialData) {
      setName(initialData.name + " (Copy)");
      setInstructions(initialData.instructions);
      setIngredients(
        initialData.ingredients.map((ing) => ({ ...ing })) || [
          { name: "", quantity: "", unit: "" },
        ]
      );
    } else {
      setName("");
      setInstructions("");
      setIngredients([{ name: "", quantity: "", unit: "" }]);
    }
  }, [initialData]);

  const addIngredientField = () => {
    setIngredients([...ingredients, { name: "", quantity: "", unit: "" }]);
  };

  const updateIngredient = (
    index: number,
    field: keyof RecipeIngredient,
    value: string
  ) => {
    const newIngredients = [...ingredients];
    newIngredients[index] = { ...newIngredients[index], [field]: value };
    setIngredients(newIngredients);
  };

  const removeIngredientField = (index: number) => {
    const newIngredients = ingredients.filter((_, i) => i !== index);
    setIngredients(
      newIngredients.length > 0
        ? newIngredients
        : [{ name: "", quantity: "", unit: "" }]
    );
  };

  const saveRecipe = async () => {
    if (
      !name ||
      !instructions ||
      !ingredients.some((i) => i.name && i.quantity)
    ) {
      alert(
        "Please provide a recipe name, instructions, and at least one ingredient with name and quantity."
      );
      return;
    }

    const validIngredients = ingredients
      .map((ing) => ({
        name: ing.name.trim(),
        quantity: ing.quantity.trim(),
        unit: ing.unit.trim(),
      }))
      .filter((ing) => ing.name && ing.quantity);

    if (validIngredients.length === 0) {
      alert("Please add at least one valid ingredient.");
      return;
    }

    const recipeData = {
      name: name.trim(),
      instructions: instructions.trim(),
      ingredients: validIngredients,
    };

    setIsSaving(true);
    try {
      const response = await fetch(`${API_BASE_URL}/recipes`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(recipeData),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(
          errorData.error || `Failed to save recipe: ${response.statusText}`
        );
      }

      const savedRecipe: Recipe = await response.json();
      dispatch({ type: "ADD_RECIPE", payload: savedRecipe });

      if (onClear) onClear();
      else {
        setName("");
        setInstructions("");
        setIngredients([{ name: "", quantity: "", unit: "" }]);
      }
    } catch (error: any) {
      console.error("Error saving recipe:", error);
      alert(`Error: ${error.message}`);
    } finally {
      setIsSaving(false);
    }
  };

  const handleClear = () => {
    if (onClear) {
      onClear();
    } else {
      setName("");
      setInstructions("");
      setIngredients([{ name: "", quantity: "", unit: "" }]);
    }
  };

  return (
    <Card className="mb-4">
      <Card.Body>
        <Card.Title>
          <FontAwesomeIcon icon={faTools} className="me-2" />
          {initialData ? "Edit Recipe Copy" : "Create Custom Recipe"}
        </Card.Title>
        <Form>
          <Form.Group className="mb-3">
            <Form.Label>Name</Form.Label>
            <Form.Control
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </Form.Group>
          {ingredients.map((ingredient, index) => (
            <Row key={index} className="mb-2 align-items-center">
              <Col xs={4}>
                <Form.Control
                  placeholder="Ingredient"
                  value={ingredient.name}
                  onChange={(e) =>
                    updateIngredient(index, "name", e.target.value)
                  }
                />
              </Col>
              <Col xs={3}>
                <Form.Control
                  placeholder="Quantity"
                  value={ingredient.quantity}
                  onChange={(e) =>
                    updateIngredient(index, "quantity", e.target.value)
                  }
                />
              </Col>
              <Col xs={3}>
                <Form.Control
                  placeholder="Unit"
                  value={ingredient.unit}
                  onChange={(e) =>
                    updateIngredient(index, "unit", e.target.value)
                  }
                />
              </Col>
              <Col xs={2}>
                {ingredients.length > 1 && (
                  <Button
                    variant="outline-danger"
                    size="sm"
                    onClick={() => removeIngredientField(index)}
                  >
                    <FontAwesomeIcon icon={faTrash} />
                  </Button>
                )}
              </Col>
            </Row>
          ))}
          <Button
            variant="secondary"
            onClick={addIngredientField}
            className="mb-3 me-2"
            size="sm"
          >
            <FontAwesomeIcon icon={faPlus} className="me-1" /> Add Ingredient
          </Button>
          <Form.Group className="mb-3">
            <Form.Label>Instructions</Form.Label>
            <Form.Control
              as="textarea"
              value={instructions}
              onChange={(e) => setInstructions(e.target.value)}
            />
          </Form.Group>
          <Stack direction="horizontal" gap={2}>
            <Button onClick={saveRecipe} disabled={isSaving}>
              <FontAwesomeIcon
                icon={isSaving ? faSpinner : faSave}
                spin={isSaving}
                className="me-1"
              />{" "}
              Save Recipe
            </Button>
            <Button
              variant="outline-secondary"
              onClick={handleClear}
              disabled={isSaving}
            >
              <FontAwesomeIcon icon={faEraser} className="me-1" /> Clear Form
            </Button>
          </Stack>
        </Form>
      </Card.Body>
    </Card>
  );
};

const RecipeBrowser: React.FC = () => {
  const { state } = useContext(AppContext);
  const [search, setSearch] = useState("");
  const [showMakeable, setShowMakeable] = useState(false);
  const filteredRecipes = useRecipeFilter(
    state.recipes,
    state.ingredients,
    search,
    showMakeable
  );

  const hasIngredient = useCallback((ingredientName: string): boolean => {
    return state.ingredients.some(
      (i) => i.name.toLowerCase() === ingredientName.toLowerCase()
    );
  }, [state.ingredients]);

  return (
    <div>
      <InputGroup className="mb-3">
        <InputGroup.Text>
          <FontAwesomeIcon icon={faSearch} />
        </InputGroup.Text>
        <Form.Control
          placeholder="Search recipes..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <Form.Check
          type="switch"
          label="Show only makeable recipes"
          checked={showMakeable}
          onChange={(e) => setShowMakeable(e.target.checked)}
          className="ms-2"
        />
      </InputGroup>
      <Row xs={1} md={2} lg={3} className="g-4">
        {filteredRecipes.map((recipe) => {
          const canMake = recipe.ingredients.every((ri) => hasIngredient(ri.name));
          return (
            <Col key={recipe.id}>
              <Card border={canMake ? "success" : undefined}>
                <Card.Body>
                  <Card.Title>{recipe.name}</Card.Title>
                  <ListGroup variant="flush" className="mb-2">
                    {recipe.ingredients.map((ingredient, index) => {
                      const userHasIngredient = hasIngredient(ingredient.name);
                      return (
                        <ListGroup.Item
                          key={index}
                          className={`d-flex justify-content-between align-items-center ${userHasIngredient ? '' : 'text-muted'}`}
                        >
                          <span>
                            {ingredient.quantity} {ingredient.unit}{" "}
                            {ingredient.name}
                          </span>
                        </ListGroup.Item>
                      );
                    })}
                  </ListGroup>
                  <Card.Text>{recipe.instructions}</Card.Text>
                </Card.Body>
              </Card>
            </Col>
          );
        })}
      </Row>
      {filteredRecipes.length === 0 && (
        <div className="text-center mt-4">
          <p>
            No recipes found. Try adjusting your search or adding more
            ingredients.
          </p>
        </div>
      )}
    </div>
  );
};

interface RecipeManagerProps {
  onEdit: (recipe: Recipe) => void;
}

const RecipeManager: React.FC<RecipeManagerProps> = ({ onEdit }) => {
  const { state, dispatch } = useContext(AppContext);
  const sortedRecipes = useMemo(
    () =>
      [...state.recipes].sort((a, b) =>
        a.name.localeCompare(b.name)
      ),
    [state.recipes]
  );

  const removeRecipe = async (id: number) => {
    try {
      const response = await fetch(`${API_BASE_URL}/recipes/${id}`, {
        method: "DELETE",
      });
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(
          errorData.error || `Failed to delete recipe: ${response.statusText}`
        );
      }
      dispatch({ type: "REMOVE_RECIPE", payload: id });
    } catch (error: any) {
      console.error("Error deleting recipe:", error);
      alert(`Error: ${error.message}`);
    }
  };

  return (
    <Card>
      <Card.Body>
        <Card.Title>
          <FontAwesomeIcon icon={faListAlt} className="me-2" />
          Recipe Management
        </Card.Title>
        <ListGroup style={{ maxHeight: "400px", overflowY: "auto" }}>
          {sortedRecipes.map((recipe) => (
            <ListGroup.Item
              key={recipe.id}
              className="d-flex justify-content-between align-items-center"
            >
              <span>{recipe.name}</span>
              <Stack direction="horizontal" gap={1}>
                <Button
                  variant="outline-primary"
                  size="sm"
                  onClick={() => onEdit(recipe)}
                  title="Copy & Edit"
                >
                  <FontAwesomeIcon icon={faCopy} />
                </Button>
                <Button
                  variant="outline-danger"
                  size="sm"
                  onClick={() => removeRecipe(recipe.id)}
                  title="Delete"
                >
                  <FontAwesomeIcon icon={faTrash} />
                </Button>
              </Stack>
            </ListGroup.Item>
          ))}
          {sortedRecipes.length === 0 && (
            <ListGroup.Item className="text-muted">
              No recipes available. Add some using the creator above or check the backend.
            </ListGroup.Item>
          )}
        </ListGroup>
      </Card.Body>
    </Card>
  );
};

const Backroom: React.FC = () => {
  const [recipeToEdit, setRecipeToEdit] = useState<Recipe | null>(null);

  const handleEditRecipe = (recipe: Recipe) => {
    setRecipeToEdit(recipe);
  };

  const handleClearRecipeForm = () => {
    setRecipeToEdit(null);
  };

  return (
    <Row>
      <Col md={5}>
        <IngredientManager />
      </Col>
      <Col md={7}>
        <RecipeCreator
          initialData={recipeToEdit}
          onClear={handleClearRecipeForm}
        />
        <RecipeManager onEdit={handleEditRecipe} />
      </Col>
    </Row>
  );
};

const App: React.FC = () => {
  const [theme, setTheme] = useState<"light" | "dark">(() => {
    return (localStorage.getItem("bartenderTheme") as "light" | "dark") || "light";
  });

  useEffect(() => {
    document.documentElement.setAttribute("data-bs-theme", theme);
    localStorage.setItem("bartenderTheme", theme);
  }, [theme]);

  const toggleTheme = () => {
    setTheme(theme === "light" ? "dark" : "light");
  };

  const [state, dispatch] = useReducer(reducer, initialState);

  useEffect(() => {
    const fetchData = async () => {
      dispatch({ type: "SET_LOADING", payload: true });
      dispatch({ type: "SET_ERROR", payload: null });
      try {
        const [ingredientsRes, recipesRes] = await Promise.all([
          fetch(`${API_BASE_URL}/ingredients`),
          fetch(`${API_BASE_URL}/recipes`),
        ]);

        // Helper function to process response
        const processResponse = async (response: Response, resourceName: string) => {
          if (!response.ok) {
            // Try to get more specific error from backend if possible
            let errorMsg = `Failed to fetch ${resourceName}: ${response.status} ${response.statusText}`;
            try {
              const errorData = await response.json();
              errorMsg = errorData.error || errorMsg;
            } catch (e) {
              // If response is not JSON, maybe it's HTML?
              const textError = await response.text();
              if (textError.toLowerCase().includes("<!doctype html")) {
                 errorMsg += ". Received HTML instead of JSON. Check API endpoint and proxy configuration.";
              } else {
                 errorMsg += `. Response body: ${textError.substring(0, 100)}...`; // Show snippet
              }
            }
            throw new Error(errorMsg);
          }

          // Check content type before parsing
          const contentType = response.headers.get("content-type");
          if (contentType && contentType.includes("application/json")) {
            return await response.json();
          } else {
            // Handle cases where the server responded with 2xx but not JSON
            const responseText = await response.text();
             if (responseText.toLowerCase().includes("<!doctype html")) {
               throw new Error(`Received HTML instead of JSON for ${resourceName}. Check API endpoint and proxy configuration.`);
             }
             throw new Error(`Expected JSON for ${resourceName}, but received: ${contentType || 'unknown content type'}. Response: ${responseText.substring(0,100)}...`);
          }
        };

        const ingredientsData: Ingredient[] = await processResponse(ingredientsRes, 'ingredients');
        const recipesData: Recipe[] = await processResponse(recipesRes, 'recipes');

        dispatch({ type: "SET_INGREDIENTS", payload: ingredientsData });
        dispatch({ type: "SET_RECIPES", payload: recipesData });
      } catch (error: any) {
        console.error("Error fetching initial data:", error);
        // Use the potentially more specific error message from processResponse
        dispatch({ type: "SET_ERROR", payload: error.message });
      }
    };

    fetchData();
  }, []);

  return (
    <AppContext.Provider value={{ state, dispatch }}>
      <Navbar bg={theme} variant={theme} expand="lg" className="mb-4">
        <Container>
          <Navbar.Brand href="#home">
            <FontAwesomeIcon icon={faCocktail} className="me-2" />
            Personal Bartender Assistant
          </Navbar.Brand>
          <Navbar.Toggle aria-controls="basic-navbar-nav" />
          <Navbar.Collapse id="basic-navbar-nav" className="justify-content-end">
            <Button variant="outline-secondary" onClick={toggleTheme}>
              <FontAwesomeIcon icon={theme === "light" ? faMoon : faSun} />
            </Button>
          </Navbar.Collapse>
        </Container>
      </Navbar>

      <Container className="py-4">
        {state.loading && (
          <div className="text-center my-5">
            <FontAwesomeIcon icon={faSpinner} spin size="3x" />
            <p className="mt-2">Loading data...</p>
          </div>
        )}

        {state.error && !state.loading && (
          <div className="alert alert-danger" role="alert">
            <strong>Error:</strong> {state.error} <br />
            Please ensure the backend server is running (locally or in Docker) and accessible.
            If running the frontend locally (e.g., with `npm run dev`), ensure the development server's proxy is correctly configured to forward requests from <code>{API_BASE_URL}</code> to the backend.
            You might need to refresh the page once the server and proxy are ready.
          </div>
        )}

        {!state.loading && !state.error && (
          <Tabs defaultActiveKey="bar" className="mb-4" fill>
            <Tab
              eventKey="bar"
              title={
                <span>
                  <FontAwesomeIcon icon={faWhiskeyGlass} className="me-1" /> Bar
                </span>
              }
            >
              <RecipeBrowser />
            </Tab>
            <Tab
              eventKey="backroom"
              title={
                <span>
                  <FontAwesomeIcon icon={faWarehouse} className="me-1" />{" "}
                  Backroom
                </span>
              }
            >
              <Backroom />
            </Tab>
          </Tabs>
        )}
      </Container>
    </AppContext.Provider>
  );
};

export default App;
