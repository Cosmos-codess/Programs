class DimensionalFigure {
    int x, y;

    final void setDimensions(int a, int b) {
        x = a;
        y = b;
        System.out.println("Dimensions: " + x + ", " + y);
    }
}

// Multilevel inheritance
class Rectangle extends DimensionalFigure {
    int area;

    void calculateArea(int a, int b) {
        super.setDimensions(a, b);   // using super
        area = x * y;
        System.out.println("Rectangle Area: " + area);
    }
}

// Multilevel inheritance
class Cuboid extends Rectangle {
    int z;

    void calculateVolume(int a, int b, int c) {
        z = c;
        super.calculateArea(a, b);   // using super
        int volume = area * z;
        System.out.println("Cuboid Volume: " + volume);
    }
}

// Hierarchical inheritance
class Circle extends DimensionalFigure {
    void calculateCircle(int r) {
        super.setDimensions(r, r);   // using super
        double area = 3.14 * r * r;
        System.out.println("Circle Area: " + area);
    }
}

public class week4 {
    public static void main(String[] args) {

        Cuboid obj1 = new Cuboid();
        obj1.calculateVolume(2, 3, 4);

        Circle obj2 = new Circle();
        obj2.calculateCircle(5);
    }
}