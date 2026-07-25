import type {
  MyGardenElementType,
  MyGardenPlantType,
} from "./myGardenCatalog";

export type MyGardenMutation =
  | {
      action: "builder";
      actionId: string;
      mode: "place" | "remove";
      category: "plant" | "path" | "element";
      itemType: MyGardenPlantType | MyGardenElementType | "path" | null;
      cells: Array<{ gridX: number; gridY: number }>;
    }
  | {
      action: "plant";
      gridX: number;
      gridY: number;
      plantType: MyGardenPlantType;
    }
  | { action: "toggle-path"; gridX: number; gridY: number }
  | { action: "uproot"; plantId: string }
  | { action: "expand" }
  | {
      action: "place-element";
      gridX: number;
      gridY: number;
      elementType: MyGardenElementType;
    }
  | { action: "remove-element"; elementId: string };
