public class week7 {

    class A extends Thread {
        public void run() {
            for (int i = 1; i <= 5; i++) {
                System.out.println("I am in A - " + i);
            }
        }
    }

    class B extends Thread {
        public void run() {
            for (int i = 1; i <= 5; i++) {
                System.out.println("I am in B - " + i);
            }
        }
    }

    class C extends Thread {
        public void run() {
            for (int i = 1; i <= 5; i++) {
                System.out.println("I am in C - " + i);
            }
        }
    }

    public static void main(String[] args) {
        week7 obj = new week7();

        A a = obj.new A();
        B b = obj.new B();
        C c = obj.new C();

        a.start();
        b.start();
        c.start();
    }
}
