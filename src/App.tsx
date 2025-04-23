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
  faCheck,
  faTimes,
  faSun,
  faMoon,
} from "@fortawesome/free-solid-svg-icons";

// Types
type Ingredient = { id: string; name: string };
type RecipeIngredient = { name: string; quantity: string; unit: string };
type Recipe = {
  id: string;
  name: string;
  ingredients: RecipeIngredient[];
  instructions: string;
  isCustom: boolean;
};

// Pre-populated standard recipes
const STANDARD_RECIPES: Recipe[] = [
  {
    id: "1",
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
    id: "2",
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

// State management
type State = { ingredients: Ingredient[]; customRecipes: Recipe[] };
type Action =
  | { type: "ADD_INGREDIENT"; payload: Ingredient }
  | { type: "REMOVE_INGREDIENT"; payload: string }
  | { type: "ADD_RECIPE"; payload: Recipe }
  | { type: "REMOVE_RECIPE"; payload: string };

const initialState: State = { ingredients: [], customRecipes: [] };
const AppContext = createContext<{
  state: State;
  dispatch: React.Dispatch<Action>;
}>({ state: initialState, dispatch: () => null });

const reducer = (state: State, action: Action): State => {
  switch (action.type) {
    case "ADD_INGREDIENT":
      return { ...state, ingredients: [...state.ingredients, action.payload] };
    case "REMOVE_INGREDIENT":
      return {
        ...state,
        ingredients: state.ingredients.filter((i) => i.id !== action.payload),
      };
    case "ADD_RECIPE":
      return {
        ...state,
        customRecipes: [...state.customRecipes, action.payload],
      };
    case "REMOVE_RECIPE":
      return {
        ...state,
        customRecipes: state.customRecipes.filter(
          (r) => r.id !== action.payload
        ),
      };
    default:
      return state;
  }
};

// Custom hooks
const useLocalStorage = <T,>(key: string, initialValue: T) => {
  const [value, setValue] = useState<T>(() => {
    try {
      const stored = localStorage.getItem(key);
      return stored ? JSON.parse(stored) : initialValue;
    } catch (error) {
      console.error("Error reading localStorage key “" + key + "”:", error);
      return initialValue;
    }
  });

  useEffect(() => {
    try {
      localStorage.setItem(key, JSON.stringify(value));
    } catch (error) {
      console.error("Error setting localStorage key “" + key + "”:", error);
    }
  }, [key, value]);

  return [value, setValue] as const;
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

  const addIngredient = (nameToAdd?: string) => {
    const ingredientName = (nameToAdd || newIngredient).trim();
    if (
      ingredientName &&
      !state.ingredients.some(
        (i) => i.name.toLowerCase() === ingredientName.toLowerCase()
      )
    ) {
      dispatch({
        type: "ADD_INGREDIENT",
        payload: { id: Date.now().toString(), name: ingredientName },
      });
      if (!nameToAdd) {
        setNewIngredient("");
      }
    }
  };

  const quickAddIngredient = (name: string) => {
    addIngredient(name);
  };

  const availableSuggestions = useMemo(() => {
    const allRecipes = [...STANDARD_RECIPES, ...state.customRecipes];
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
  }, [state.ingredients, state.customRecipes]);

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
          />
          <Button onClick={() => addIngredient()}>
            <FontAwesomeIcon icon={faPlus} className="me-1" /> Add
          </Button>
        </InputGroup>

        {/* Ingredient Grid */}
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
                  onClick={() =>
                    dispatch({
                      type: "REMOVE_INGREDIENT",
                      payload: ingredient.id,
                    })
                  }
                >
                  <FontAwesomeIcon icon={faTrash} size="xs" />
                </Button>
              </Badge>
            ))
          ) : (
            <small className="text-muted">No ingredients added yet.</small>
          )}
        </div>

        {/* Quick Select Section */}
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

  const saveRecipe = () => {
    if (
      name &&
      instructions &&
      ingredients.every((i) => i.name && i.quantity)
    ) {
      const validIngredients = ingredients.filter(
        (i) => i.name || i.quantity || i.unit
      );

      if (
        validIngredients.length === 0 &&
        ingredients.length > 0 &&
        !(
          ingredients.length === 1 &&
          !ingredients[0].name &&
          !ingredients[0].quantity &&
          !ingredients[0].unit
        )
      ) {
        console.warn("Attempted to save recipe with empty ingredient rows.");
        return;
      }

      dispatch({
        type: "ADD_RECIPE",
        payload: {
          id: Date.now().toString(),
          name,
          ingredients: validIngredients
            .map((ing) => ({
              name: ing.name.trim(),
              quantity: ing.quantity.trim(),
              unit: ing.unit.trim(),
            }))
            .filter((ing) => ing.name && ing.quantity),
          instructions,
          isCustom: true,
        },
      });
      if (onClear) onClear();
      else {
        setName("");
        setInstructions("");
        setIngredients([{ name: "", quantity: "", unit: "" }]);
      }
    } else {
      console.warn(
        "Recipe save failed: Missing name, instructions, or ingredient name/quantity."
      );
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
            <Button onClick={saveRecipe}>
              <FontAwesomeIcon icon={faSave} className="me-1" /> Save Recipe
            </Button>
            <Button variant="outline-secondary" onClick={handleClear}>
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
  const allRecipes = [...STANDARD_RECIPES, ...state.customRecipes];
  const filteredRecipes = useRecipeFilter(
    allRecipes,
    state.ingredients,
    search,
    showMakeable
  );

  // Helper to check ingredient availability (case-insensitive)
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
          return (
            <Col key={recipe.id}>
              <Card>
                <Card.Body>
                  <Card.Title>{recipe.name}</Card.Title>
                  <ListGroup variant="flush" className="mb-2">
                    {recipe.ingredients.map((ingredient, index) => {
                      const userHasIngredient = hasIngredient(ingredient.name);
                      return (
                        <ListGroup.Item
                          key={index}
                          className="d-flex justify-content-between align-items-center"
                        >
                          <span>
                            {ingredient.quantity} {ingredient.unit}{" "}
                            {ingredient.name}
                          </span>
                          {userHasIngredient ? (
                            <FontAwesomeIcon
                              icon={faCheck}
                              className="text-success"
                              title="You have this"
                            />
                          ) : (
                            <FontAwesomeIcon
                              icon={faTimes}
                              className="text-danger"
                              title="Missing ingredient"
                            />
                          )}
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
  const allRecipes = useMemo(
    () =>
      [...STANDARD_RECIPES, ...state.customRecipes].sort((a, b) =>
        a.name.localeCompare(b.name)
      ),
    [state.customRecipes]
  );

  return (
    <Card>
      <Card.Body>
        <Card.Title>
          <FontAwesomeIcon icon={faListAlt} className="me-2" />
          Recipe Management
        </Card.Title>
        <ListGroup style={{ maxHeight: "400px", overflowY: "auto" }}>
          {allRecipes.map((recipe) => (
            <ListGroup.Item
              key={recipe.id}
              className="d-flex justify-content-between align-items-center"
            >
              <span>
                {recipe.name}{" "}
                {!recipe.isCustom && (
                  <Badge bg="info" text="dark" pill className="ms-2">
                    Std
                  </Badge>
                )}
              </span>
              <Stack direction="horizontal" gap={1}>
                <Button
                  variant="outline-primary"
                  size="sm"
                  onClick={() => onEdit(recipe)}
                  title="Copy & Edit"
                >
                  <FontAwesomeIcon icon={faCopy} />
                </Button>
                {recipe.isCustom && (
                  <Button
                    variant="outline-danger"
                    size="sm"
                    onClick={() =>
                      dispatch({ type: "REMOVE_RECIPE", payload: recipe.id })
                    }
                    title="Delete"
                  >
                    <FontAwesomeIcon icon={faTrash} />
                  </Button>
                )}
              </Stack>
            </ListGroup.Item>
          ))}
          {allRecipes.length === 0 && (
            <ListGroup.Item className="text-muted">
              No recipes available.
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
  // Theme state
  const [theme, setTheme] = useLocalStorage<"light" | "dark">(
    "bartenderTheme",
    "light"
  );

  // Apply theme to HTML element
  useEffect(() => {
    document.documentElement.setAttribute("data-bs-theme", theme);
  }, [theme]);

  const toggleTheme = () => {
    setTheme(theme === "light" ? "dark" : "light");
  };

  const [storedState, setStoredState] = useLocalStorage(
    "bartenderState",
    initialState
  );
  const [state, dispatch] = useReducer(reducer, storedState);

  useEffect(() => {
    setStoredState(state);
  }, [state, setStoredState]);

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
                <FontAwesomeIcon icon={faWarehouse} className="me-1" /> Backroom
              </span>
            }
          >
            <Backroom />
          </Tab>
        </Tabs>
      </Container>
    </AppContext.Provider>
  );
};

export default App;
